import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Clarity VM interactions
const mockClarity = {
  txSender: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
  blockHeight: 100,
  vehicles: new Map(),
  vehicleOwners: new Map(),
  
  // Constants
  ERR_UNAUTHORIZED: 1,
  ERR_ALREADY_REGISTERED: 2,
  ERR_NOT_FOUND: 3,
  
  // Helper to simulate contract calls
  callPublic(fn, args, sender = null) {
    if (sender) this.txSender = sender;
    return this[fn](...args);
  },
  
  // Contract functions
  registerVehicle(vehicleId, model, capacity) {
    // Check if vehicle already exists
    if (this.vehicles.has(vehicleId)) {
      return { type: 'err', value: this.ERR_ALREADY_REGISTERED };
    }
    
    // Add vehicle to registry
    this.vehicles.set(vehicleId, {
      owner: this.txSender,
      model,
      capacity,
      registrationDate: this.blockHeight,
      active: true
    });
    
    // Update owner's vehicle count
    const currentCount = this.vehicleOwners.get(this.txSender)?.vehicleCount || 0;
    this.vehicleOwners.set(this.txSender, { vehicleCount: currentCount + 1 });
    
    return { type: 'ok', value: true };
  },
  
  updateVehicleStatus(vehicleId, active) {
    // Check if vehicle exists
    if (!this.vehicles.has(vehicleId)) {
      return { type: 'err', value: this.ERR_NOT_FOUND };
    }
    
    const vehicle = this.vehicles.get(vehicleId);
    
    // Check if sender is owner
    if (vehicle.owner !== this.txSender) {
      return { type: 'err', value: this.ERR_UNAUTHORIZED };
    }
    
    // Update status
    this.vehicles.set(vehicleId, { ...vehicle, active });
    
    return { type: 'ok', value: true };
  },
  
  getVehicleDetails(vehicleId) {
    return this.vehicles.get(vehicleId) || null;
  },
  
  isVehicleActive(vehicleId) {
    return this.vehicles.get(vehicleId)?.active || false;
  }
};

describe('Vehicle Registration Contract', () => {
  beforeEach(() => {
    // Reset the mock state
    mockClarity.vehicles.clear();
    mockClarity.vehicleOwners.clear();
    mockClarity.blockHeight = 100;
    mockClarity.txSender = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
  });
  
  describe('registerVehicle', () => {
    it('should register a new vehicle successfully', () => {
      const result = mockClarity.callPublic('registerVehicle', ['vehicle-123', 'Test Car', 4]);
      
      expect(result.type).toBe('ok');
      expect(result.value).toBe(true);
      
      const vehicle = mockClarity.vehicles.get('vehicle-123');
      expect(vehicle).toBeDefined();
      expect(vehicle.model).toBe('Test Car');
      expect(vehicle.capacity).toBe(4);
      expect(vehicle.active).toBe(true);
      
      const ownerData = mockClarity.vehicleOwners.get(mockClarity.txSender);
      expect(ownerData.vehicleCount).toBe(1);
    });
    
    it('should fail when registering a vehicle that already exists', () => {
      // Register once
      mockClarity.callPublic('registerVehicle', ['vehicle-123', 'Test Car', 4]);
      
      // Try to register again
      const result = mockClarity.callPublic('registerVehicle', ['vehicle-123', 'Another Car', 6]);
      
      expect(result.type).toBe('err');
      expect(result.value).toBe(mockClarity.ERR_ALREADY_REGISTERED);
    });
    
    it('should allow different users to register vehicles', () => {
      // First user registers
      mockClarity.callPublic('registerVehicle', ['vehicle-123', 'Test Car', 4]);
      
      // Second user registers
      const result = mockClarity.callPublic(
          'registerVehicle',
          ['vehicle-456', 'Another Car', 6],
          'ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'
      );
      
      expect(result.type).toBe('ok');
      expect(mockClarity.vehicles.size).toBe(2);
    });
  });
  
  describe('updateVehicleStatus', () => {
    it('should update vehicle status when owner calls', () => {
      // Register a vehicle first
      mockClarity.callPublic('registerVehicle', ['vehicle-123', 'Test Car', 4]);
      
      // Update status
      const result = mockClarity.callPublic('updateVehicleStatus', ['vehicle-123', false]);
      
      expect(result.type).toBe('ok');
      expect(mockClarity.vehicles.get('vehicle-123').active).toBe(false);
    });
    
    it('should fail when non-owner tries to update status', () => {
      // Register a vehicle first
      mockClarity.callPublic('registerVehicle', ['vehicle-123', 'Test Car', 4]);
      
      // Different user tries to update
      const result = mockClarity.callPublic(
          'updateVehicleStatus',
          ['vehicle-123', false],
          'ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'
      );
      
      expect(result.type).toBe('err');
      expect(result.value).toBe(mockClarity.ERR_UNAUTHORIZED);
      expect(mockClarity.vehicles.get('vehicle-123').active).toBe(true);
    });
    
    it('should fail when vehicle does not exist', () => {
      const result = mockClarity.callPublic('updateVehicleStatus', ['non-existent', false]);
      
      expect(result.type).toBe('err');
      expect(result.value).toBe(mockClarity.ERR_NOT_FOUND);
    });
  });
  
  describe('read-only functions', () => {
    it('should return vehicle details correctly', () => {
      // Register a vehicle first
      mockClarity.callPublic('registerVehicle', ['vehicle-123', 'Test Car', 4]);
      
      const vehicle = mockClarity.getVehicleDetails('vehicle-123');
      
      expect(vehicle).toBeDefined();
      expect(vehicle.model).toBe('Test Car');
      expect(vehicle.capacity).toBe(4);
    });
    
    it('should return null for non-existent vehicle', () => {
      const vehicle = mockClarity.getVehicleDetails('non-existent');
      expect(vehicle).toBeNull();
    });
    
    it('should check if vehicle is active correctly', () => {
      // Register a vehicle first
      mockClarity.callPublic('registerVehicle', ['vehicle-123', 'Test Car', 4]);
      
      // Initially active
      expect(mockClarity.isVehicleActive('vehicle-123')).toBe(true);
      
      // Update to inactive
      mockClarity.callPublic('updateVehicleStatus', ['vehicle-123', false]);
      
      // Should now be inactive
      expect(mockClarity.isVehicleActive('vehicle-123')).toBe(false);
    });
  });
});


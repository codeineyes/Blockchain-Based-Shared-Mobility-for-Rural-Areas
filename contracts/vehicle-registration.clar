;; Vehicle Registration Contract
;; Records details of community-shared vehicles

;; Define data maps
(define-map vehicles
  { vehicle-id: (string-utf8 36) }
  {
    owner: principal,
    model: (string-utf8 50),
    capacity: uint,
    registration-date: uint,
    active: bool
  }
)

(define-map vehicle-owners
  { owner: principal }
  { vehicle-count: uint }
)

;; Error codes
(define-constant ERR_UNAUTHORIZED u1)
(define-constant ERR_ALREADY_REGISTERED u2)
(define-constant ERR_NOT_FOUND u3)

;; Register a new vehicle
(define-public (register-vehicle
    (vehicle-id (string-utf8 36))
    (model (string-utf8 50))
    (capacity uint))
  (let
    ((owner tx-sender)
     (current-count (default-to u0 (get vehicle-count (map-get? vehicle-owners {owner: owner})))))

    ;; Check if vehicle already exists
    (asserts! (is-none (map-get? vehicles {vehicle-id: vehicle-id})) (err ERR_ALREADY_REGISTERED))

    ;; Add vehicle to the registry
    (map-set vehicles
      {vehicle-id: vehicle-id}
      {
        owner: owner,
        model: model,
        capacity: capacity,
        registration-date: block-height,
        active: true
      }
    )

    ;; Update owner's vehicle count
    (map-set vehicle-owners
      {owner: owner}
      {vehicle-count: (+ current-count u1)}
    )

    (ok true)
  )
)

;; Update vehicle status (active/inactive)
(define-public (update-vehicle-status (vehicle-id (string-utf8 36)) (active bool))
  (let ((vehicle-data (map-get? vehicles {vehicle-id: vehicle-id})))
    ;; Check if vehicle exists
    (asserts! (is-some vehicle-data) (err ERR_NOT_FOUND))

    ;; Check if sender is the owner
    (asserts! (is-eq tx-sender (get owner (unwrap-panic vehicle-data))) (err ERR_UNAUTHORIZED))

    ;; Update vehicle status
    (map-set vehicles
      {vehicle-id: vehicle-id}
      (merge (unwrap-panic vehicle-data) {active: active})
    )

    (ok true)
  )
)

;; Read-only function to get vehicle details
(define-read-only (get-vehicle-details (vehicle-id (string-utf8 36)))
  (map-get? vehicles {vehicle-id: vehicle-id})
)

;; Read-only function to check if vehicle is active
(define-read-only (is-vehicle-active (vehicle-id (string-utf8 36)))
  (default-to false (get active (map-get? vehicles {vehicle-id: vehicle-id})))
)


# Technical Decisions

## 1. Server-Side Pagination and Filtering

- **Decision:** Use server-side pagination, filtering, searching, and sorting for the orders list.
- **Alternatives:** Fetch all orders and filter in the browser, or implement client-side virtualization.
- **Reason:** The application must handle large datasets without transferring every order to the client.
- **Trade-off:** The API and database queries are more complex, but network usage and browser memory are reduced.
- **Implementation:** The API accepts pagination, search, status, and sorting parameters, with a bounded page size.
- **Future improvement:** Evaluate cursor-based pagination if deep offset pagination becomes too expensive at scale.

## 2. Idempotent Order Creation

- **Decision:** Require an `Idempotency-Key` for order creation and enforce its uniqueness in the database.
- **Alternatives:** Disable the submit button, perform an application-level duplicate check only, or use a distributed lock.
- **Reason:** Client-side controls cannot prevent concurrent requests or retries from creating duplicate orders.
- **Implementation:** The server checks the key, compares the request payload, and handles unique-constraint conflicts caused by concurrent requests.
- **Trade-off:** The implementation must define how repeated keys and conflicting payloads are handled.
- **Expected behavior:** Repeating the same request returns the existing result; reusing the key with different data returns a conflict.
- **Validation:** An automated concurrency test verifies that two simultaneous identical requests create exactly one order.

## 3. Authentication and Authorization

- **Decision:** Use signed JWT access tokens with expiration, verified on protected routes, and resolve the user and role from server-side data.
- **Alternatives:** Use opaque session tokens backed by server-side sessions, or rely on client-side role checks.
- **Reason:** Protected API access must be enforced by the backend rather than by the user interface.
- **Implementation:** Passwords are stored as bcrypt hashes; JWT verification checks the signature and configured claims.
- **Trade-off:** JWT revocation and permission changes require additional consideration compared with a fully server-managed session.
- **Token storage:** This implementation uses session storage in the browser. It is accessible to JavaScript, so XSS remains a risk; HttpOnly, Secure, SameSite cookies are worth considering with appropriate CSRF protection.
- **AI disclosure:** AI assistance was used during implementation and troubleshooting. The final code, tests, and design decisions should be reviewed and verified by the submitting developer.
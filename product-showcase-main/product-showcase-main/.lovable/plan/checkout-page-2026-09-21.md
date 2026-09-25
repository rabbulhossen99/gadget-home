# Checkout Page

## Build
- Add a dedicated `/checkout` page matching the supplied mobile reference while retaining the shop’s green-and-orange design system.
- Include delivery fields for name, mobile number, and full address with clear validation feedback.
- Add inside/outside Dhaka delivery selection, coupon input, live subtotal/delivery/total calculations, cash-on-delivery notice, and order confirmation feedback.
- Keep the checkout compact and touch-friendly on phones, while using a balanced two-column layout on laptops.
- Connect both “Buy now” buttons on the product page to checkout and carry the selected package, quantity, and total in the URL.

## Validation
- Verify field errors, delivery-price switching, coupon behavior, successful confirmation, product-to-checkout navigation, and layouts at mobile and laptop sizes.
- Add unique checkout page metadata and confirm there are no browser errors or horizontal overflow.

## Technical details
- Use TanStack Router for `/checkout` and URL search parameters for the selected package, quantity, and subtotal.
- Keep the experience frontend-only; confirmed orders are not persisted or sent to a payment service.

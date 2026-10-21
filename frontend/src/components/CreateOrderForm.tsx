
import { useState, type FormEvent } from "react";
import { apiRequest } from "../services/api";

type OrderItemInput = {
  productName: string;
  quantity: number;
  unitPrice: string;
};

type CreateOrderFormProps = {
  onClose: () => void;
  onCreated: () => void;
};

const createEmptyItem = (): OrderItemInput => ({
  productName: "",
  quantity: 1,
  unitPrice: "",
});

export default function CreateOrderForm({
  onClose,
  onCreated,
}: CreateOrderFormProps) {
  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [items, setItems] = useState<OrderItemInput[]>([
    createEmptyItem(),
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const total = items.reduce((sum, item) => {
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);

    if (
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      !Number.isFinite(unitPrice) ||
      unitPrice < 0
    ) {
      return sum;
    }

    return sum + quantity * Math.round(unitPrice * 100);
  }, 0);

  function updateItem(
    index: number,
    field: keyof OrderItemInput,
    value: string | number,
  ) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  }

  function addItem() {
    if (items.length < 5) {
      setItems((current) => [...current, createEmptyItem()]);
    }
  }

  function removeItem(index: number) {
    setItems((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const normalizedItems = items.map((item) => ({
      productName: item.productName.trim(),
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
    }));

    const invalidItem = normalizedItems.some(
      (item) =>
        !item.productName ||
        !Number.isSafeInteger(item.quantity) ||
        item.quantity < 1 ||
        !Number.isFinite(item.unitPrice) ||
        item.unitPrice < 0,
    );

    if (!customerName.trim() || !email.trim()) {
      setError("Enter the customer's name and email.");
      return;
    }

    if (invalidItem) {
      setError("Check each product name, quantity, and unit price.");
      return;
    }

    setLoading(true);

    try {
      await apiRequest("/orders", {
        method: "POST",
        headers: {
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          customerName: customerName.trim(),
          email: email.trim(),
          items: normalizedItems,
        }),
      });

      onCreated();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create order.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !loading) onClose();
    }}>
      <section
        className="create-order-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-order-title"
      >
        <div className="modal-heading">
          <div>
            <h2 id="create-order-title">Create order</h2>
            <p>Add a customer and one to five line items.</p>
          </div>

          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            disabled={loading}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="customerName">Customer name</label>
            <input
              id="customerName"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              required
              maxLength={120}
              placeholder="e.g. Ahmed Hassan"
            />
          </div>

          <div className="form-field">
            <label htmlFor="customerEmail">Customer email</label>
            <input
              id="customerEmail"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              maxLength={254}
              placeholder="customer@example.com"
            />
          </div>

          <div className="items-heading">
            <h3>Order items</h3>
            <span>{items.length} / 5</span>
          </div>

          {items.map((item, index) => (
            <div className="order-item-fields" key={index}>
              <div className="form-field product-field">
                <label htmlFor={`product-${index}`}>Product</label>
                <input
                  id={`product-${index}`}
                  value={item.productName}
                  onChange={(event) =>
                    updateItem(index, "productName", event.target.value)
                  }
                  required
                  maxLength={120}
                  placeholder="Product name"
                />
              </div>

              <div className="form-field quantity-field">
                <label htmlFor={`quantity-${index}`}>Qty</label>
                <input
                  id={`quantity-${index}`}
                  type="number"
                  min={1}
                  step={1}
                  value={item.quantity}
                  onChange={(event) =>
                    updateItem(index, "quantity", Number(event.target.value))
                  }
                  required
                />
              </div>

              <div className="form-field price-field">
                <label htmlFor={`price-${index}`}>Unit price</label>
                <input
                  id={`price-${index}`}
                  type="number"
                  min={0}
                  step="0.01"
                  value={item.unitPrice}
                  onChange={(event) =>
                    updateItem(index, "unitPrice", event.target.value)
                  }
                  required
                  placeholder="0.00"
                />
              </div>

              {items.length > 1 && (
                <button
                  type="button"
                  className="remove-item-button"
                  onClick={() => removeItem(index)}
                  disabled={loading}
                  aria-label={`Remove item ${index + 1}`}
                >
                  ×
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            className="add-item-button"
            onClick={addItem}
            disabled={loading || items.length >= 5}
          >
            + Add item
          </button>

          <div className="order-total">
            <span>Calculated total</span>
            <strong>
              {(total / 100).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </strong>
          </div>

          {error && (
            <div className="error-message" role="alert">
              {error}
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="primary-button"
              disabled={loading}
            >
              {loading ? "Creating..." : "Create order"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

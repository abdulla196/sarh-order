
import { useEffect, useState } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Package,
} from "lucide-react";
import { apiRequest } from "../services/api";
import type { Order, OrdersResponse } from "../types/order";
import CreateOrderForm from "./CreateOrderForm";
import "./OrdersDashboard.css";

const statusOptions = [
  { value: "", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "PROCESSING", label: "Processing" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatMoney(value: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value));
}

export default function OrdersDashboard({
  onLogout,
}: {
  onLogout: () => void;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sortBy, setSortBy] = useState<"createdAt" | "totalAmount">(
    "createdAt",
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadOrders() {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pagination.pageSize),
        sortBy,
        sortOrder,
      });

      if (search) params.set("search", search);
      if (status) params.set("status", status);

      try {
        const result = await apiRequest<OrdersResponse>(
          `/orders?${params.toString()}`,
          { signal: controller.signal },
        );

        setOrders(result.data);
        setPagination(result.pagination);
      } catch (err) {
        if (controller.signal.aborted) return;

        setError(
          err instanceof Error ? err.message : "Failed to load orders.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadOrders();

    return () => controller.abort();
  }, [search, status, sortBy, sortOrder, page, pagination.pageSize, refreshKey]);

  function handleStatusChange(value: string) {
    setStatus(value);
    setPage(1);
  }

  function handleSortChange(value: string) {
    setSortBy(value as "createdAt" | "totalAmount");
    setPage(1);
  }

  function handleSortOrderChange(value: string) {
    setSortOrder(value as "asc" | "desc");
    setPage(1);
  }

  const statusCounts = orders.reduce(
    (counts, order) => {
      counts[order.status] += 1;
      return counts;
    },
    {
      PENDING: 0,
      PROCESSING: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    },
  );

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <div className="dashboard-brand">
          <div className="dashboard-logo">S</div>
          <div>
            <strong>SARH</strong>
            <span>ORDER MANAGEMENT</span>
          </div>
        </div>

        <button className="logout-button" onClick={onLogout}>
          <LogOut size={17} />
          Sign out
        </button>
      </header>

      <section className="dashboard-content">
        <div className="page-heading">
          <div>
            <p className="dashboard-eyebrow">OPERATIONS / ORDERS</p>
            <h1>Orders</h1>
            <p className="page-description">
              Monitor and manage customer orders in one place.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setRefreshKey((current) => current + 1)}
            >
            Refresh
        </button>
        <button
            type="button"
            className="primary-button"
            onClick={() => setCreateOrderOpen(true)}
            >
            + Create order
        </button>
        </div>

        <section className="stats-grid">
          <article className="stat-card">
            <span>Total matching orders</span>
            <strong>{pagination.total.toLocaleString()}</strong>
            <small>Based on current filters</small>
          </article>
          <article className="stat-card">
            <span>Pending on this page</span>
            <strong>{statusCounts.PENDING}</strong>
            <small>Current page only</small>
          </article>
          <article className="stat-card">
            <span>Processing on this page</span>
            <strong>{statusCounts.PROCESSING}</strong>
            <small>Current page only</small>
          </article>
          <article className="stat-card">
            <span>Completed on this page</span>
            <strong>{statusCounts.COMPLETED}</strong>
            <small>Current page only</small>
          </article>
        </section>

        <section className="orders-card">
          <div className="orders-card-heading">
            <div>
              <h2>All orders</h2>
              <p>Search, filter and sort your orders.</p>
            </div>
            <span className="orders-total">
              {pagination.total.toLocaleString()} results
            </span>
          </div>

          <div className="orders-filters">
            <div className="search-field">
              <Search size={18} />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search customer or email..."
                aria-label="Search orders by customer name or email"
              />
            </div>

            <select
              value={status}
              onChange={(event) => handleStatusChange(event.target.value)}
              aria-label="Filter by status"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(event) => handleSortChange(event.target.value)}
              aria-label="Sort field"
            >
              <option value="createdAt">Order date</option>
              <option value="totalAmount">Amount</option>
            </select>

            <select
              value={sortOrder}
              onChange={(event) => handleSortOrderChange(event.target.value)}
              aria-label="Sort direction"
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>

          {error && (
            <div className="dashboard-error" role="alert">
              {error}
              {error.toLowerCase().includes("token") && (
                <button onClick={onLogout}>Sign in again</button>
              )}
            </div>
          )}

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Order ID</th>
                  <th>Status</th>
                  <th>Items</th>
                  <th>Amount</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="table-message">
                      Loading orders...
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="table-message">
                      <Package size={24} />
                      <span>No orders found.</span>
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <div className="customer-name">
                          {order.customerName}
                        </div>
                        <div className="customer-email">{order.email}</div>
                      </td>
                      <td>
                        <code title={order.id}>{order.id.slice(0, 10)}</code>
                      </td>
                      <td>
                        <span
                          className={`status-badge status-${order.status.toLowerCase()}`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td>{order._count.items}</td>
                      <td className="amount-cell">
                        {formatMoney(order.totalAmount)}
                      </td>
                      <td>{formatDate(order.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <footer className="pagination">
            <span>
              {pagination.total === 0
                ? "No results"
                : `Page ${page} of ${pagination.totalPages} · ${pagination.total.toLocaleString()} orders`}
            </span>

            <div className="pagination-actions">
              <button
                aria-label="Previous page"
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => current - 1)}
              >
                <ChevronLeft size={17} />
                Previous
              </button>
              <button
                aria-label="Next page"
                disabled={page >= pagination.totalPages || loading}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
                <ChevronRight size={17} />
              </button>
            </div>
          </footer>
        </section>
      </section>
      {createOrderOpen && (
        <CreateOrderForm
            onClose={() => setCreateOrderOpen(false)}
            onCreated={() => {
            setPage(1);
            setRefreshKey((current) => current + 1);
            }}
        />
        )}
    </main>
    
  );
}

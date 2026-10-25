import React, { useEffect, useState } from 'react';
import apiClient from '../api/apiClient';
import PaginationControls from '../components/PaginationControls';
import LoadingSkeleton from '../components/LoadingSkeleton';

export default function UsersPage() {

  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const [form, setForm] = useState({
    name: '',
    username: '',
    password: '',
    password_confirmation: '',
    role: 'committee_officer',
  });

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [users.length]);

  async function loadUsers() {

    try {
      const { data } = await apiClient.get('/users');
      setUsers(data.data);
    } finally {
      setIsLoading(false);
    }

  }

  async function handleCreate(e) {

    e.preventDefault();

    if (form.password !== form.password_confirmation) {

      alert('Passwords do not match.');

      return;

    }

    await apiClient.post('/users', form);

    setForm({
      name: '',
      username: '',
      password: '',
      password_confirmation: '',
      role: 'committee_officer',
    });

    await loadUsers();

  }

  async function handleDelete(id, name) {

    const confirmed = window.confirm(
      `Are you sure you want to delete "${name}"?`
    );

    if (!confirmed) return;

    try {

      await apiClient.delete(`/users/${id}`);

      await loadUsers();

    } catch (err) {

      alert(
        err.response?.data?.message ||
        'Failed to delete user.'
      );

    }

  }

  const totalUsers = users.length;

  const admins = users.filter(
    (u) => u.role === 'admin'
  ).length;

  const committee = users.filter(
    (u) => u.role === 'committee_officer'
  ).length;

  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(users.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const visibleUsers = users.slice(startIndex, startIndex + pageSize);
  const startItem = users.length === 0 ? 0 : startIndex + 1;
  const endItem = Math.min(startIndex + pageSize, users.length);

  if (isLoading && users.length === 0) {
    return <LoadingSkeleton variant="users" label="Loading users" />;
  }

  return (

    <div>

      <h1 style={{ marginBottom: '25px' }}>
        User Management
      </h1>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
          gap: '20px',
          marginBottom: '35px',
        }}
      >

        <div
          style={{
            background: '#fff',
            padding: '22px',
            borderRadius: '12px',
            borderLeft: '5px solid var(--primary-2)',
            boxShadow: '0 3px 10px rgba(0,0,0,.08)',
          }}
        >
          <h3>Total Users</h3>
          <h1 style={{ color: 'var(--primary-2)' }}>
            {totalUsers}
          </h1>
        </div>

        <div
          style={{
            background: '#fff',
            padding: '22px',
            borderRadius: '12px',
            borderLeft: '5px solid var(--accent)',
            boxShadow: '0 3px 10px rgba(0,0,0,.08)',
          }}
        >
          <h3>Administrators</h3>
          <h1 style={{ color: 'var(--accent)' }}>
            {admins}
          </h1>
        </div>

        <div
          style={{
            background: '#fff',
            padding: '22px',
            borderRadius: '12px',
            borderLeft: '5px solid var(--primary-2)',
            boxShadow: '0 3px 10px rgba(0,0,0,.08)',
          }}
        >
          <h3>Student Electoral Committee</h3>
          <h1 style={{ color: 'var(--primary-2)' }}>
            {committee}
          </h1>
        </div>

      </div>

      <div
        style={{
          background: '#fff',
          padding: '25px',
          borderRadius: '12px',
          boxShadow: '0 3px 10px rgba(0,0,0,.08)',
          marginBottom: '35px',
        }}
      >

        <h2>Add New User</h2>

        <form
          onSubmit={handleCreate}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
            gap: "15px",
            alignItems: "center",
            marginTop: "20px",
          }}
        >

          <input
            placeholder="Full Name"
            value={form.name}
            onChange={(e) =>
              setForm({
                ...form,
                name: e.target.value,
              })
            }
            required
          />

          <input
            type="text"
            placeholder="Username"
            value={form.username}
            onChange={(e) =>
              setForm({
                ...form,
                username: e.target.value,
              })
            }
            required
          />

          <input
            type="password"
            placeholder="Temporary Password"
            value={form.password}
            onChange={(e) =>
              setForm({
                ...form,
                password: e.target.value,
              })
            }
            required
          />

          <input
            type="password"
            placeholder="Confirm Password"
            value={form.password_confirmation}
            onChange={(e) =>
              setForm({
                ...form,
                password_confirmation: e.target.value,
              })
            }
            required
          />
          <select
            value={form.role}
            onChange={(e) =>
              setForm({
                ...form,
                role: e.target.value,
              })
            }
            style={{
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid #ccc",
              width: "100%",
            }}
          >
            <option value="committee_officer">
              Student Electoral Committee
            </option>

            <option value="admin">
              Administrator
            </option>

          </select>

          <button
            type="submit"
            style={{
              width: "100%",
              padding: "10px",
            }}
          >
           ✛ Create User
          </button>

        </form>

      </div>

      <div className="table-shell">

      <table className="data-table">

        <thead>

          <tr>

            <th>User</th>
            <th>Username</th>
            <th>Role</th>
            <th style={{ width: "150px" }}>
              Actions
            </th>

          </tr>

        </thead>

        <tbody>

          {visibleUsers.map((u) => (

            <tr key={u.id}>

              <td>
                <strong>{u.name}</strong>
              </td>

              <td>{u.username || u.email}</td>

              <td>

                <span
                  className="badge"
                  style={{
                    background:
                      u.role === "admin"
                        ? "#198754"
                        : "#0d6efd",
                    color: "#fff",
                    padding: "5px 10px",
                    borderRadius: "20px",
                    fontSize: "13px",
                  }}
                >
                  {u.role === "admin"
                    ? "Administrator"
                    : "Student Electoral Committee"}
                </span>

              </td>

              <td>

                <button
                  className="danger-button"
                  onClick={() =>
                    handleDelete(u.id, u.name)
                  }
                >
                  Delete
                </button>

              </td>

            </tr>

          ))}

        </tbody>

      </table>

      </div>

      <PaginationControls
        currentPage={safeCurrentPage}
        totalPages={totalPages}
        totalItems={users.length}
        startItem={startItem}
        endItem={endItem}
        onPrevious={() => setCurrentPage((page) => Math.max(1, page - 1))}
        onNext={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
      />

    </div>

  );

}

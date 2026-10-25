import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import apiClient from '../api/apiClient';
import LoadingSkeleton from '../components/LoadingSkeleton';

export default function VerifyBallotPage() {

  const { serialNumber } = useParams();

  const [ballot, setBallot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadBallot();
  }, [serialNumber]);

  async function loadBallot() {
    try {

      const { data } = await apiClient.get(
        `/ballots/verify/${serialNumber}`
      );

      setBallot(data.data);

    } catch (err) {

      setError(
        err.response?.data?.message ||
        'Ballot not found.'
      );

    } finally {

      setLoading(false);

    }
  }

  function getStatusInfo(status) {

    switch (status) {

      case 'issued':
        return {
          emoji: '',
          title: 'Ballot Generated',
          message:
            'Your ballot has been generated but has not yet been scanned.'
        };

      case 'counted':
        return {
          emoji: '',
          title: 'Ballot Counted',
          message:
            'Your ballot has been successfully counted.'
        };

      case 'manual_review':
        return {
          emoji: '',
          title: 'Under Manual Review',
          message:
            'Your ballot is currently being reviewed by the election committee.'
        };

      case 'duplicate_rejected':
        return {
          emoji: '',
          title: 'Duplicate Rejected',
          message:
            'This ballot has been rejected because it was already submitted.'
        };

      default:
        return {
          emoji: '',
          title: 'Unknown Status',
          message:
            'The ballot status is currently unavailable.'
        };

    }

  }

  if (loading) {
    return <LoadingSkeleton variant="verify" label="Loading ballot verification" />;
  }

  if (error) {
    return (
      <div className="public-results">

        <h1>Verification Failed</h1>

        <p>{error}</p>

      </div>
    );
  }

  const statusInfo = getStatusInfo(ballot.status);

  const statusStyles = {

    issued: {
      background: '#FFF8DB',
      border: '#F4D03F'
    },

    counted: {
      background: '#EAF9EE',
      border: '#27AE60'
    },

    manual_review: {
      background: '#FFF2E2',
      border: '#F39C12'
    },

    duplicate_rejected: {
      background: '#FDECEC',
      border: '#E74C3C'
    }

  };

  const style =
    statusStyles[ballot.status] || {
      background: '#F8F9FA',
      border: '#CED4DA'
    };

  return (

    <div className="public-results">

      <h1>Ballot Verified</h1>

      <div
        style={{
          background: style.background,
          border: `2px solid ${style.border}`,
          borderRadius: '12px',
          padding: '18px',
          marginBottom: '25px',
          textAlign: 'center'
        }}
      >

        <h2 style={{ marginBottom: '10px' }}>
          {statusInfo.emoji} {statusInfo.title}
        </h2>

        <p
          style={{
            color: '#555',
            fontSize: '15px'
          }}
        >
          {statusInfo.message}
        </p>

      </div>

      <table className="data-table">

        <tbody>

          <tr>
            <th>Election</th>
            <td>{ballot.election}</td>
          </tr>

          <tr>
            <th>Serial Number</th>
            <td>{ballot.serial_number}</td>
          </tr>

          <tr>
            <th>Status</th>

            <td>

              <span
                className={`badge badge-${ballot.status}`}
              >
                {ballot.status.replace('_', ' ')}
              </span>

            </td>

          </tr>

          <tr>
            <th>Generated</th>

            <td>

              {ballot.generated_at
                ? new Date(ballot.generated_at).toLocaleString()
                : 'N/A'}

            </td>

          </tr>

        </tbody>

      </table>

      <br />

      <div
        style={{
          background: '#EEF6FF',
          border: '1px solid #BFDCFF',
          borderRadius: '10px',
          padding: '15px'
        }}
      >

        <strong>Privacy Notice</strong>

        <p
          style={{
            marginTop: '10px',
            color: '#555',
            lineHeight: '1.6'
          }}
        >
          This page only verifies that your ballot exists and
          shows its processing status.
          <br /><br />
          It never reveals the candidates you voted for,
          your vote selections, or any election results
          associated with your ballot.
        </p>

      </div>

    </div>

  );

}

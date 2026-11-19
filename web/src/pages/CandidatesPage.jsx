import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../api/apiClient';
import LoadingSkeleton from '../components/LoadingSkeleton';

export default function CandidatesPage() {
  const { positionId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    apiClient.get(`/positions/${positionId}/candidates`)
      .then(({ data }) => {
        if (active && data.position?.election_id) {
          navigate(`/elections/${data.position.election_id}/candidates?position=${positionId}`, { replace: true });
        }
      })
      .catch(() => {
        if (active) navigate('/elections', { replace: true });
      });

    return () => { active = false; };
  }, [navigate, positionId]);

  return <LoadingSkeleton variant="candidates" label="Opening candidate management" />;

}

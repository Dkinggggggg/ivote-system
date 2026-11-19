import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../api/apiClient';
import LoadingSkeleton from '../components/LoadingSkeleton';
import './PrintBallot.css';
import logo from '../assets/logo.png';
import { positionsForBallot } from '../utils/ballotPositions';

export default function PrintBallotPage() {

  const { ballotId } = useParams();
  const navigate = useNavigate();

  const [ballot, setBallot] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadBallot();
  }, [ballotId]);

  async function loadBallot() {
    try {
      const response = await apiClient.get(`/ballots/${ballotId}`);
      setBallot(response.data.data);
    } catch (error) {
      console.error(error);
      setError('Unable to load ballot');
    }
  }

  if (error) {
    return <p>{error}</p>;
  }

  if (!ballot) {
    return <LoadingSkeleton variant="ballot" label="Loading ballot" />;
  }

  const election = ballot.election;

  return (
    <div className="ballot">
      <div className="registration-markers" aria-hidden="true">
        <span className="registration-mark top-left" />
        <span className="registration-mark top-right" />
        <span className="registration-mark bottom-left" />
        <span className="registration-mark bottom-right" />
      </div>

      {/* Hidden when printing */}
      <div className="print-hide">

        <button className="back-button" onClick={() => navigate('/ballots')}>
          ← Back to Ballots
        </button>

        <button
          onClick={() => window.print()}
          style={{ marginLeft: '10px' }}
        >
          🖨 Print Ballot
        </button>

      </div>

      <div className="ballot-header">
        <img src={logo} alt="Electoral Committee" />
        <h1>Office of the Student Electoral Committee</h1>
        <p>Iloilo Science and Technology University Dumangas Campus</p>
        <p>secisatudc2026@gmail.com</p>
      </div>

      <h1 className="center ballot-title">{election.title}</h1>

      <h2 className="center">OFFICIAL BALLOT</h2>

      <div className="ballot-info">

        <div>
          <strong>Ballot Serial No.</strong>
          <br />
          {ballot.serial_number}
        </div>

      </div>

      <div className="ballot-instructions">
        <p><strong>VOTE WISELY!</strong></p>
        <p>Please vote according to your respective department and batch year. Make sure to follow the correct voting guidelines.</p>
        <p><strong>⚠️ Any vote that does not follow these instructions will be considered INVALID</strong></p>
      </div>

      <hr />

      <div className="ballot-positions">
      {positionsForBallot(election.positions, ballot.serial_number).map((position) => (

        <div
          key={position.id}
          className={`position ${position.name.toLowerCase().includes('senator') ? 'wide-position' : ''}`}
        >

          <h3>{position.name}</h3>

          <strong>
            Vote for: {position.vote_for_count}
          </strong>

          <div className="candidates candidate-list">

            {position.candidates?.map((candidate, index) => (

              <div
                key={candidate.id}
                className="candidate"
              >

                <span className="shade-box"></span>

                <span>
                  {index + 1}. {candidate.name}
                  {candidate.party && ` (${candidate.party})`}
                </span>

              </div>

            ))}

          </div>

          <hr />

        </div>

      ))}
      </div>

      <div className="center footer">

        <p>Do not write anything else on this ballot.</p>

        <strong>{ballot.serial_number}</strong>

        <p className="ballot-quote">
          "Bad student leaders get elected when good citizens vote blindly."
        </p>

      </div>

    </div>
  );
}
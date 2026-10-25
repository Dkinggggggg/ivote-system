import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import apiClient from '../api/apiClient';
import LoadingSkeleton from '../components/LoadingSkeleton';
import './PrintBallot.css';
import logo from '../assets/logo.png';
import { positionsForBallot } from '../utils/ballotPositions';

export default function PrintMultipleBallotsPage() {

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [ballots, setBallots] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const hasMarkedPrinted = useRef(false);

  const pdfMode = searchParams.get('pdf') === '1';

  const ballotPages = [];

  for (let i = 0; i < ballots.length; i += 2) {
    ballotPages.push(ballots.slice(i, i + 2));
  }

  useEffect(() => {
    loadBallots();
  }, []);

  useEffect(() => {
    if (!pdfMode || ballots.length === 0) return;

    const timer = setTimeout(() => {
      window.print();
    }, 500);

    return () => clearTimeout(timer);
  }, [pdfMode, ballots.length]);

  useEffect(() => {
    if (ballots.length === 0 || pdfMode) return;

    const handleAfterPrint = async () => {
      if (hasMarkedPrinted.current) return;

      hasMarkedPrinted.current = true;

      try {
        await apiClient.post('/ballots/mark-printed', {
          ids: ballots.map((ballot) => ballot.id),
        });
      } catch (err) {
        console.error(err);
      }
    };

    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [ballots, pdfMode]);

  async function loadBallots() {

    try {

      const ids = searchParams.get('ids');
      const quantity = searchParams.get('quantity');
      const next = searchParams.get('next');

      if (ids) {

        const response = await apiClient.get('/ballots/print-selected', {
          params: { ids },
        });

        setBallots(response.data.data);
      }

      else if (next) {

        const response = await apiClient.get('/ballots/print-next-batch', {
          params: {
            election_id: searchParams.get('election_id'),
            batch_size: searchParams.get('batch_size'),
            program: searchParams.get('program'),
            year_level: searchParams.get('year_level'),
          },
        });

        setBallots(response.data.data);

      }

      else if (quantity) {

        const response = await apiClient.get(
          `/ballots/print/${quantity}`
        );

        setBallots(response.data.data);

      }

      else {

        setError('No ballots selected.');

      }

    } catch (err) {

      console.error(err);

      setError(
        err.response?.data?.message ||
        'Unable to load ballots.'
      );

    } finally {

      setLoading(false);

    }

  }

  if (loading) {

    return <LoadingSkeleton variant="print" label="Loading ballots" />;

  }

  if (error) {

    return (

      <div>

        <h2>{error}</h2>

        <button
          className="back-button"
          onClick={() => navigate('/ballots')}
          style={{ alignSelf: 'flex-start' }}
        >
          ← Back to Ballots
        </button>

      </div>

    );

  }

  return (

    <div className={pdfMode ? 'pdf-export-mode print-ballot-page' : 'print-ballot-page'}>

      <div className="print-controls print-hide">

        <button
          className="back-button"
          onClick={() => navigate('/ballots')}
        >
          ← Back to Ballots
        </button>

        {!pdfMode && (
          <button
            onClick={() => window.print()}
            style={{
              marginLeft: '10px'
            }}
          >
            🖨 Print Ballots
          </button>
        )}

      </div>

      <div className="ballot-container">

        {ballotPages.map((pageBallots, pageIndex) => (

          <div
            key={`page-${pageIndex}`}
            className="ballot-page"
          >

            {pageBallots.map((ballot) => (

              <div
                key={ballot.id}
                className="half-ballot"
              >
                <div className="registration-markers" aria-hidden="true">
                  <span className="registration-mark top-left" />
                  <span className="registration-mark top-right" />
                  <span className="registration-mark bottom-left" />
                  <span className="registration-mark bottom-right" />
                </div>

                <div className="ballot-header">
                  <img src={logo} alt="Electoral Committee" />
                  <h1>Office of the Student Electoral Committee</h1>
                  <p>Iloilo Science and Technology University Dumangas Campus</p>
                  <p>secisatudc2026@gmail.com</p>
                </div>

                <h2>
                  {ballot.election.title}
                </h2>

                <h3>
                  OFFICIAL BALLOT
                </h3>

                <div className="serial-number">
                  <strong>Ballot Serial No.:</strong> {ballot.serial_number}

                </div>

                <div className="qr-small">

                  <QRCodeCanvas
                    value={ballot.serial_number}
                    size={40}
                  />

                </div>

                <p className="instruction">Vote wisely!</p>

                <hr />

                <div className="ballot-positions">
                {positionsForBallot(ballot.election.positions, ballot.serial_number).map((position) => (

                  <div
                    key={position.id}
                    className={`position-small ${position.name.toLowerCase().includes('senator') ? 'wide-position' : ''}`}
                  >

                    <strong>{position.name}</strong>

                    <div>
                      Vote for {position.vote_for_count}
                    </div>

                    <div className="candidate-list">
                    {position.candidates?.map((candidate, index) => (

                      <div
                        key={candidate.id}
                        className="candidate-small"
                      >

                        <span className="shade-box"></span>

                        {index + 1}. {candidate.name}

                        {candidate.party && (
                          <span>
                            {' '}({candidate.party})
                          </span>
                        )}

                      </div>

                    ))}
                    </div>

                  </div>

                ))}
                </div>

                <hr />

                <div className="center">

                  <small>
                    Do not write anything else.
                  </small>

                  <br />

                  <small>
                    {ballot.serial_number}
                  </small>

                  <p className="ballot-quote">
                    "Bad student leaders get elected when good citizens vote blindly."
                  </p>

                </div>

              </div>

            ))}

          </div>

        ))}

      </div>

    </div>

  );

}
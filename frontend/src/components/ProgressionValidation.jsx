import React, { useEffect, useState } from 'react';
import api from '../services/api';

function StatusIcon({ type, size = 22 }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };

  const icons = {
    approved: (<><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.2 2.2 4.8-5" /></>),
    rejected: (<><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6" /><path d="m15 9-6 6" /></>),
    pending: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
    calendar: (<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></>),
  };

  return <svg {...common}>{icons[type]}</svg>;
}

const ProgressionValidation = ({ idOperation, typeDefault = null }) => {
  const [progression, setProgression] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadProgression = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/api/workflow/progression/${idOperation}`);
        setProgression(res.data);
        setError(null);
      } catch (err) {
        console.error('Erreur chargement progression:', err);
        setError('Impossible de charger la progression');
      } finally {
        setLoading(false);
      }
    };

    if (idOperation) {
      loadProgression();
    }
  }, [idOperation]);

  if (loading) {
    return (
      <div className="progression-container">
        <div style={{ textAlign: 'center', padding: '30px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', color: '#112033' }}>
            <StatusIcon type="pending" />
            <p style={{ margin: 0 }}>Chargement de la progression...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !progression) {
    return (
      <div className="progression-container">
        <div style={{ textAlign: 'center', padding: '30px', color: '#e74c3c' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
            <StatusIcon type="rejected" />
            <p style={{ margin: 0 }}>{error || 'Impossible de charger la progression'}</p>
          </div>
        </div>
      </div>
    );
  }

  const { etapes, progression: percentProgression, statut_final, demandeur, type_demande, date_demande } = progression;

  const getStatusClass = () => {
    if (statut_final.includes('REFUSÉE')) return 'refusee';
    if (statut_final.includes('APPROUVÉE')) return 'validee';
    return 'en-cours';
  };

  const getStatusIcon = () => {
    if (statut_final.includes('REFUSÉE')) return 'rejected';
    if (statut_final.includes('APPROUVÉE')) return 'approved';
    return 'pending';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="progression-wrapper">
      <div className="progression-container">
        {/* Header Card */}
        <div className="progression-header-card">
          <div className="progression-header-content">
            <div className="progression-header-title">
              <span className="progression-status-icon"><StatusIcon type={getStatusIcon()} /></span>
              <div>
                <h2>Progression de Validation</h2>
                <p className="progression-subtitle">
                  {demandeur && <span>{demandeur.nom_complet} - </span>}
                  <strong>{type_demande || typeDefault || 'Demande'}</strong>
                </p>
              </div>
            </div>
            <div className={`progression-status-badge ${getStatusClass()}`}>
              {statut_final}
            </div>
          </div>
        </div>

        {/* Main Content - Centered */}
        <div className="progression-main">
          {/* Progress Percentage Circle */}
          <div className="progression-stats">
            <div className="stat-item">
              <div className="stat-number">{percentProgression}%</div>
              <div className="stat-label">Progression</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">{etapes.filter(e => e.statut === 'validé').length}/{etapes.length}</div>
              <div className="stat-label">Validations</div>
            </div>
          </div>

          {/* Progress bar horizontal */}
          <div className="progression-bar-container">
            <div className="progression-bar">
              <div
                className={`progression-bar-fill ${
                  statut_final.includes('REFUSÉE') ? 'refusee' : ''
                }`}
                style={{ width: `${percentProgression}%` }}
              />
            </div>
          </div>

          {/* Vertical Steps Timeline - Professional Design */}
          <div className="progression-timeline-horizontal">
            {etapes && etapes.map((etape, idx) => (
              <div key={etape.numero} className="timeline-step-horizontal">
                {/* Connector line before */}
                {idx > 0 && (
                  <div className={`connector-line ${
                    etapes[idx - 1].statut === 'validé' ? 'validee' : 'pending'
                  }`} />
                )}

                {/* Step bubble */}
                <div
                  className={`step-bubble ${
                    etape.statut === 'validé'
                      ? 'validee'
                      : etape.statut === 'refusé'
                      ? 'refusee'
                      : 'en-attente'
                  }`}
                  title={etape.validateur || 'En attente'}
                >
                  <div className="bubble-content">
                    <div className="bubble-icon">
                      {etape.statut === 'validé' ? 'OK' : etape.statut === 'refusé' ? 'KO' : etapes.length - idx}
                    </div>
                    <div className="bubble-role">{etape.role}</div>
                    {etape.validateur && <div className="bubble-name">{etape.validateur.split(' ')[0]}</div>}
                  </div>
                </div>

                {/* Tooltip on hover */}
                {(etape.validateur || etape.date || etape.commentaire) && (
                  <div className="step-tooltip">
                    {etape.validateur && <div className="tooltip-line"><strong>{etape.validateur}</strong></div>}
                    {etape.date && <div className="tooltip-line tooltip-date">{formatDate(etape.date)}</div>}
                    {etape.commentaire && <div className="tooltip-line tooltip-comment">{etape.commentaire}</div>}
                    {etape.statut === 'en attente' && <div className="tooltip-line tooltip-pending">En attente</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Info Footer */}
        {date_demande && (
          <div className="progression-footer">
            <span className="footer-icon"><StatusIcon type="calendar" size={14} /></span>
            Demandée le <strong>{formatDate(date_demande)}</strong>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgressionValidation;

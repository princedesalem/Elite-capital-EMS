import React, { useEffect, useState } from 'react';
import api from '../services/api';
import ModifiedBadge from './ModifiedBadge';

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

const ProgressionValidation = ({ idOperation, typeDefault = null, onClose = null, refreshTrigger = 0 }) => {
  const [progression, setProgression] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!idOperation) return;
    let cancelled = false;
    const timers = [];

    const fetchOnce = async (silent) => {
      try {
        const res = await api.get(`/api/workflow/progression/${idOperation}`);
        if (cancelled) return;
        setProgression(res.data);
        setError(null);
        // Arrêter les retries dès que date_vue est trouvée
        if (silent && res.data?.etapes?.some(e => e.date_vue)) {
          timers.forEach(clearTimeout);
        }
      } catch (err) {
        console.error('Erreur chargement progression:', err);
        if (!silent && !cancelled) setError('Impossible de charger la progression');
      } finally {
        // !cancelled évite le flash "Impossible" quand l'effet est nettoyé avant la fin du fetch
        if (!silent && !cancelled) setLoading(false);
      }
    };

    // Toujours faire un fetch (silencieux si on a déjà des données, sinon afficher loading)
    // Cela couvre aussi le remontage de la modal avec refreshTrigger > 0
    const alreadyHasData = progression !== null;
    if (!alreadyHasData) setLoading(true);
    fetchOnce(alreadyHasData);

    // Après un marquer-vu : retries silencieux pour couvrir la latence DB
    if (refreshTrigger > 0) {
      [350, 900, 1500].forEach((delay) => {
        const t = setTimeout(() => { if (!cancelled) fetchOnce(true); }, delay);
        timers.push(t);
      });
    }

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idOperation, refreshTrigger]);

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

  const { etapes, progression: percentProgression, statut_final, demandeur, type_demande, date_demande, est_modifie, date_modification } = progression;

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
                <h2>Progression de validation</h2>
                <p className="progression-subtitle">
                  {demandeur && <span>{demandeur.nom_complet} - </span>}
                  <strong>{type_demande || typeDefault || 'Demande'}</strong>
                </p>
                <div style={{ marginTop: 8 }}>
                  <ModifiedBadge estModifie={est_modifie} dateModification={date_modification} />
                </div>
              </div>
            </div>
            <div className="progression-header-actions">
              <div className={`progression-status-badge ${getStatusClass()}`}>
                {statut_final}
              </div>
              {onClose && (
                <button
                  type="button"
                  className="progression-close-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                  }}
                  aria-label="Fermer"
                  title="Fermer"
                >
                  x
                </button>
              )}
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

          {/* Timeline verticale : étapes séquentielles + lignes horizontales pour validateurs parallèles (ex: multi-DG) */}
          <div className="progression-timeline-horizontal">
            {(() => {
              // Regrouper les étapes consécutives qui partagent le même `groupe` parallèle
              const rows = []
              for (let i = 0; i < etapes.length; i++) {
                const e = etapes[i]
                if (e.parallele && e.groupe) {
                  const group = [e]
                  while (i + 1 < etapes.length && etapes[i + 1].parallele && etapes[i + 1].groupe === e.groupe) {
                    group.push(etapes[i + 1])
                    i++
                  }
                  rows.push({ type: 'parallel', items: group })
                } else {
                  rows.push({ type: 'single', item: e })
                }
              }

              const renderBubble = (etape, rowIdx) => (
                <div
                  key={`${etape.numero}-${etape.matricule_validateur_attendu || etape.role}`}
                  className="timeline-step-horizontal"
                >
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
                        {etape.statut === 'validé' ? 'OK' : etape.statut === 'refusé' ? 'KO' : etapes.length - rowIdx}
                      </div>
                      <div className="bubble-role">{etape.role}</div>
                      {etape.validateur && <div className="bubble-name">{etape.validateur.split(' ')[0]}</div>}
                    </div>
                  </div>

                  {/* Tooltip toujours affiché pour chaque étape */}
                  <div className="step-tooltip">
                    {etape.validateur && <div className="tooltip-line"><strong>{etape.validateur}</strong></div>}

                    {/* Reçu le — toujours affiché */}
                    <div className="tooltip-line tooltip-date">
                      <span style={{ color: '#64748b' }}>Reçu le :</span>{' '}
                      {etape.date_recu
                        ? formatDate(etape.date_recu)
                        : <em style={{ color: '#94a3b8' }}>En attente</em>}
                    </div>

                    {/* Vu le — toujours affiché, pour tous les statuts */}
                    <div className="tooltip-line tooltip-date">
                      <span style={{ color: '#64748b' }}>Vu le :</span>{' '}
                      {etape.date_vue
                        ? formatDate(etape.date_vue)
                        : <em style={{ color: '#94a3b8' }}>Pas encore vue</em>}
                    </div>

                    {/* Validé/Refusé le — affiché quand une décision a été prise */}
                    {(etape.statut === 'validé' || etape.statut === 'refusé') && etape.date && (
                      <div className="tooltip-line tooltip-date">
                        <span style={{ color: '#64748b' }}>
                          {etape.statut === 'validé' ? 'Validé le :' : 'Refusé le :'}
                        </span>{' '}
                        {formatDate(etape.date)}
                      </div>
                    )}

                    {etape.commentaire && <div className="tooltip-line tooltip-comment">{etape.commentaire}</div>}
                  </div>
                </div>
              )

              return rows.map((row, rIdx) => {
                const prevRow = rIdx > 0 ? rows[rIdx - 1] : null
                const prevValide = prevRow
                  ? (prevRow.type === 'parallel'
                      ? prevRow.items.every(e => e.statut === 'validé')
                      : prevRow.item.statut === 'validé')
                  : false

                return (
                  <React.Fragment key={`row-${rIdx}`}>
                    {rIdx > 0 && (
                      <div className={`connector-line ${prevValide ? 'validee' : 'pending'}`} />
                    )}
                    {row.type === 'parallel' ? (
                      <div className="timeline-parallel-row">
                        {row.items.map(etape => renderBubble(etape, rIdx))}
                      </div>
                    ) : (
                      renderBubble(row.item, rIdx)
                    )}
                  </React.Fragment>
                )
              })
            })()}
          </div>
        </div>

        {/* Info Footer */}
        {date_demande && (
          <div className="progression-footer">
            <span className="footer-icon"><StatusIcon type="calendar" size={14} /></span>
            Demandée le <strong>{formatDate(date_demande)}</strong>
            {est_modifie && date_modification && (
              <span style={{ marginLeft: 12 }}>
                • Modifiée le <strong>{formatDate(date_modification)}</strong>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgressionValidation;

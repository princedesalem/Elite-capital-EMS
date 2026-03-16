"""
Module d'envoi d'emails avec support SMTP et templates HTML
"""
import smtplib
from email.message import EmailMessage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import os
from typing import Optional, List
from datetime import date

SMTP_HOST = os.getenv('SMTP_HOST', 'smtp.gmail.com')
SMTP_PORT = int(os.getenv('SMTP_PORT', '587'))
SMTP_USER = os.getenv('SMTP_USER', '')
SMTP_PASS = os.getenv('SMTP_PASS', '')
EMAIL_FROM = os.getenv('EMAIL_FROM', 'no-reply@elitecapital.com')
SMTP_ENABLED = os.getenv('SMTP_ENABLED', 'false').lower() == 'true'


def send_email(to: str, subject: str, body: str, html: bool = False):
    """
    Envoyer un email simple en texte brut ou HTML.
    
    Args:
        to: Email du destinataire
        subject: Sujet de l'email
        body: Corps de l'email
        html: Si True, envoie en HTML, sinon en texte brut
    """
    if html:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = EMAIL_FROM
        msg['To'] = to
        
        html_part = MIMEText(body, 'html')
        msg.attach(html_part)
    else:
        msg = EmailMessage()
        msg['Subject'] = subject
        msg['From'] = EMAIL_FROM
        msg['To'] = to
        msg.set_content(body)
    
    # Si SMTP non configuré, afficher dans les logs
    if not SMTP_ENABLED or not SMTP_HOST or not SMTP_USER:
        print(f"[EMAIL NOT SENT - SMTP Disabled] to={to} subject={subject}\n{body}")
        return False
    
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)
        print(f"[EMAIL SENT] to={to} subject={subject}")
        return True
    except Exception as e:
        print(f"[EMAIL ERROR] to={to} subject={subject} error={str(e)}")
        return False


def send_validation_email(
    to_email: str,
    nom_validateur: str,
    nom_demandeur: str,
    type_demande: str,
    date_debut: date,
    date_fin: date,
    duree: int,
    motif: Optional[str],
    lien_validation: str
):
    """
    Envoyer un email de demande de validation.
    """
    subject = f"[EMS] Demande de validation - {type_demande}"
    
    html_body = f"""
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background-color: #0066cc; color: white; padding: 20px; text-align: center; }}
            .content {{ background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }}
            .info-box {{ background-color: white; padding: 15px; margin: 10px 0; border-left: 4px solid #0066cc; }}
            .button {{ background-color: #0066cc; color: white; padding: 12px 30px; text-decoration: none; display: inline-block; margin: 20px 0; border-radius: 5px; }}
            .footer {{ text-align: center; padding: 20px; font-size: 12px; color: #666; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h2>Système de Gestion EMS</h2>
                <p>Demande de Validation</p>
            </div>
            <div class="content">
                <p>Bonjour {nom_validateur},</p>
                
                <p>Une nouvelle demande nécessite votre validation :</p>
                
                <div class="info-box">
                    <strong>Demandeur:</strong> {nom_demandeur}<br>
                    <strong>Type:</strong> {type_demande}<br>
                    <strong>Période:</strong> Du {date_debut} au {date_fin}<br>
                    <strong>Durée:</strong> {duree} jours<br>
                    {f'<strong>Motif:</strong> {motif}<br>' if motif else ''}
                </div>
                
                <center>
                    <a href="{lien_validation}" class="button">Voir la demande</a>
                </center>
                
                <p style="margin-top: 20px;">Veuillez valider ou refuser cette demande dans les meilleurs délais.</p>
            </div>
            <div class="footer">
                <p>Cet email a été envoyé automatiquement par le système EMS.</p>
                <p>©  2026 ELITE CAPITAL Group</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return send_email(to_email, subject, html_body, html=True)


def send_alerte_conges_email(
    to_email: str,
    nom_employe: str,
    solde_conges: float,
    annee: int
):
    """
    Envoyer une alerte de congés de fin d'année.
    """
    subject = f"[EMS] Rappel - Solde de congés restant pour {annee}"
    
    html_body = f"""
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background-color: #ff9900; color: white; padding: 20px; text-align: center; }}
            .content {{ background-color: #fff3cd; padding: 20px; border: 1px solid #ffc107; }}
            .solde-box {{ background-color: white; padding: 20px; margin: 15px 0; text-align: center; border: 2px solid #ff9900; border-radius: 10px; }}
            .solde-number {{ font-size: 48px; font-weight: bold; color: #ff9900; }}
            .footer {{ text-align: center; padding: 20px; font-size: 12px; color: #666; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h2>⚠️ Alerte Congés</h2>
            </div>
            <div class="content">
                <p>Bonjour {nom_employe},</p>
                
                <p>Nous vous rappelons que vous avez encore des jours de congés non utilisés pour l'année {annee}.</p>
                
                <div class="solde-box">
                    <div class="solde-number">{solde_conges}</div>
                    <p style="margin: 0; color: #666;">jours de congés restants</p>
                </div>
                
                <p><strong>Important:</strong> Pensez à planifier vos congés avant la fin de l'année pour ne pas perdre votre solde.</p>
                
                <p>Pour faire une demande de congé, connectez-vous au système EMS.</p>
            </div>
            <div class="footer">
                <p>Cet email a été envoyé automatiquement par le système EMS.</p>
                <p>© 2026 ELITE CAPITAL Group</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return send_email(to_email, subject, html_body, html=True)


def send_rappel_depart_email(
    to_email: str,
    nom_rh: str,
    liste_departs: List[dict]  # [{"nom": "...", "date": "...", "duree": ...}]
):
    """
    Envoyer un rappel des départs de congés du jour (pour RH).
    """
    subject = f"[EMS] Départs en congé aujourd'hui - {len(liste_departs)} employé(s)"
    
    lignes_employes = ""
    for dep in liste_departs:
        lignes_employes += f"<li><strong>{dep['nom']}</strong> - {dep['duree']} jours (retour prévu: {dep['date_fin']})</li>"
    
    html_body = f"""
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background-color: #28a745; color: white; padding: 20px; text-align: center; }}
            .content {{ background-color: #d4edda; padding: 20px; border: 1px solid #c3e6cb; }}
            ul {{ background-color: white; padding: 20px; list-style-position: inside; }}
            .footer {{ text-align: center; padding: 20px; font-size: 12px; color: #666; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h2>📅 Départs en Congé</h2>
            </div>
            <div class="content">
                <p>Bonjour {nom_rh},</p>
                
                <p><strong>{len(liste_departs)} employé(s)</strong> partent en congé aujourd'hui :</p>
                
                <ul>
                    {lignes_employes}
                </ul>
                
                <p>Veuillez vous assurer que les procédures de passation/remplacement sont en place.</p>
            </div>
            <div class="footer">
                <p>Cet email a été envoyé automatiquement par le système EMS.</p>
                <p>© 2026 ELITE CAPITAL Group</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return send_email(to_email, subject, html_body, html=True)


def send_rappel_retour_email(
    to_email: str,
    nom_rh: str,
    liste_retours: List[dict]
):
    """
    Envoyer un rappel des retours de congés du jour (pour RH).
    """
    subject = f"[EMS] Retours de congé aujourd'hui - {len(liste_retours)} employé(s)"
    
    lignes_employes = ""
    for ret in liste_retours:
        lignes_employes += f"<li><strong>{ret['nom']}</strong> - Était parti {ret['duree']} jours</li>"
    
    html_body = f"""
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background-color: #17a2b8; color: white; padding: 20px; text-align: center; }}
            .content {{ background-color: #d1ecf1; padding: 20px; border: 1px solid #bee5eb; }}
            ul {{ background-color: white; padding: 20px; list-style-position: inside; }}
            .footer {{ text-align: center; padding: 20px; font-size: 12px; color: #666; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h2>🏠 Retours de Congé</h2>
            </div>
            <div class="content">
                <p>Bonjour {nom_rh},</p>
                
                <p><strong>{len(liste_retours)} employé(s)</strong> reviennent de congé aujourd'hui :</p>
                
                <ul>
                    {lignes_employes}
                </ul>
                
                <p>Pensez à vérifier que les opérations sont bien clôturées dans le système.</p>
            </div>
            <div class="footer">
                <p>Cet email a été envoyé automatiquement par le système EMS.</p>
                <p>© 2026 ELITE CAPITAL Group</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return send_email(to_email, subject, html_body, html=True)


def send_mission_assignment_email(
    to_email: str,
    nom_employe: str,
    pays: str,
    ville: str,
    date_debut: date,
    date_fin: date,
    nom_superieur: str
):
    """
    Envoyer un email lorsqu'un supérieur assigne une mission.
    """
    subject = f"[EMS] Nouvelle mission assignée - {ville}, {pays}"
    
    html_body = f"""
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background-color: #6c757d; color: white; padding: 20px; text-align: center; }}
            .content {{ background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; }}
            .mission-box {{ background-color: white; padding: 15px; margin: 10px 0; border-left: 4px solid #6c757d; }}
            .footer {{ text-align: center; padding: 20px; font-size: 12px; color: #666; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h2>✈️ Mission Assignée</h2>
            </div>
            <div class="content">
                <p>Bonjour {nom_employe},</p>
                
                <p>{nom_superieur} vous a assigné une nouvelle mission :</p>
                
                <div class="mission-box">
                    <strong>Destination:</strong> {ville}, {pays}<br>
                    <strong>Départ:</strong> {date_debut}<br>
                    <strong>Retour:</strong> {date_fin}<br>
                </div>
                
                <p><strong>Important:</strong> N'oubliez pas de téléverser votre rapport de mission dans les 48h après votre retour.</p>
                
                <p>Pour plus de détails, connectez-vous au système EMS.</p>
            </div>
            <div class="footer">
                <p>Cet email a été envoyé automatiquement par le système EMS.</p>
                <p>© 2026 ELITE CAPITAL Group</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return send_email(to_email, subject, html_body, html=True)


def send_preuves_permission_rappel_email(
    to_email: str,
    nom_employe: str,
    type_permission: str,
    jours_restants: int
):
    """
    Envoyer un rappel pour téléverser les preuves d'une permission conventionnelle.
    """
    subject = f"[EMS] Rappel - Preuves de permission à fournir ({jours_restants} jours restants)"
    
    urgence_class = "warning" if jours_restants <= 10 else "info"
    urgence_color = "#ff9900" if jours_restants <= 10 else "#17a2b8"
    
    html_body = f"""
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background-color: {urgence_color}; color: white; padding: 20px; text-align: center; }}
            .content {{ background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }}
            .deadline-box {{ background-color: white; padding: 20px; margin: 15px 0; text-align: center; border: 2px solid {urgence_color}; border-radius: 10px; }}
            .footer {{ text-align: center; padding: 20px; font-size: 12px; color: #666; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h2>📎 Preuves Requises</h2>
            </div>
            <div class="content">
                <p>Bonjour {nom_employe},</p>
                
                <p>Vous devez téléverser les preuves justificatives pour votre permission conventionnelle ({type_permission}).</p>
                
                <div class="deadline-box">
                    <p style="margin: 0; font-size: 18px;">Délai restant:</p>
                    <p style="margin: 10px 0; font-size: 36px; font-weight: bold; color: {urgence_color};">{jours_restants} jours</p>
                </div>
                
                <p><strong>Rappel:</strong> Les preuves doivent être fournies dans les 60 jours suivant votre demande.</p>
                
                <p>Connectez-vous au système EMS pour téléverser vos documents.</p>
            </div>
            <div class="footer">
                <p>Cet email a été envoyé automatiquement par le système EMS.</p>
                <p>© 2026 ELITE CAPITAL Group</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return send_email(to_email, subject, html_body, html=True)

import { Router } from 'express';
import db from '../db.js';

const router = Router();

// Configuration from environment variables
const TOTAL_LOTS = parseInt(process.env.TOTAL_LOTS, 10) || 75;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'irve2024';

// GET /api/stats/auth - Verify admin password
router.post('/auth', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: 'Mot de passe incorrect' });
  }
});

// GET /api/stats - Get aggregated anonymous statistics
router.get('/', (req, res) => {
  try {
    // Total responses
    const totalStmt = db.prepare('SELECT COUNT(*) as count FROM responses');
    const total = totalStmt.get().count;

    // By owner status
    const statusStmt = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM responses
      GROUP BY status
    `);
    const byStatus = Object.fromEntries(
      statusStmt.all().map(row => [row.status, row.count])
    );

    // By EV ownership
    const evStmt = db.prepare(`
      SELECT has_ev, COUNT(*) as count
      FROM responses
      GROUP BY has_ev
    `);
    const hasEv = Object.fromEntries(
      evStmt.all().map(row => [row.has_ev, row.count])
    );

    // By interest level
    const interestStmt = db.prepare(`
      SELECT interested, COUNT(*) as count
      FROM responses
      GROUP BY interested
    `);
    const interest = Object.fromEntries(
      interestStmt.all().map(row => [row.interested, row.count])
    );

    // By preferred solution (only for interested people)
    const solutionStmt = db.prepare(`
      SELECT preferred_solution, COUNT(*) as count
      FROM responses
      WHERE preferred_solution IS NOT NULL AND preferred_solution != ''
      GROUP BY preferred_solution
    `);
    const preferredSolution = Object.fromEntries(
      solutionStmt.all().map(row => [row.preferred_solution, row.count])
    );

    // Count of people with parking spots
    const parkingStmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM responses
      WHERE parking_spot IS NOT NULL AND parking_spot != ''
    `);
    const withParking = parkingStmt.get().count;

    // Count of people with comments
    const commentsStmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM responses
      WHERE comments IS NOT NULL AND comments != ''
    `);
    const withComments = commentsStmt.get().count;

    // Count of people who consented to contact
    const consentStmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM responses
      WHERE consent_contact = 1 AND email IS NOT NULL AND email != ''
    `);
    const withConsent = consentStmt.get().count;

    // By building
    const buildingStmt = db.prepare(`
      SELECT building, COUNT(*) as count
      FROM responses
      GROUP BY building
    `);
    const byBuilding = Object.fromEntries(
      buildingStmt.all().map(row => [row.building, row.count])
    );

    // By timeline
    const timelineStmt = db.prepare(`
      SELECT timeline, COUNT(*) as count
      FROM responses
      WHERE timeline IS NOT NULL AND timeline != ''
      GROUP BY timeline
    `);
    const timeline = Object.fromEntries(
      timelineStmt.all().map(row => [row.timeline, row.count])
    );

    res.json({
      total_responses: total,
      total_lots: TOTAL_LOTS,
      participation_rate: Math.round((total / TOTAL_LOTS) * 100 * 10) / 10,
      by_status: byStatus,
      by_building: byBuilding,
      has_ev: hasEv,
      interest: interest,
      preferred_solution: preferredSolution,
      with_parking: withParking,
      with_comments: withComments,
      with_consent: withConsent,
      timeline: timeline
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques'
    });
  }
});

// GET /api/stats/export - Export responses as CSV (protected)
export function handleExportCSV(req, res) {
  const adminPassword = req.headers['x-admin-password'];

  if (adminPassword !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  try {
    const stmt = db.prepare(`
      SELECT
        id,
        created_at,
        building,
        apartment,
        parking_spot,
        status,
        has_ev,
        interested,
        preferred_solution,
        timeline,
        comments,
        email,
        consent_contact
      FROM responses
      ORDER BY created_at DESC
    `);
    const responses = stmt.all();

    // CSV header
    const headers = [
      'ID',
      'Date',
      'Bâtiment',
      'Appartement',
      'Place parking',
      'Statut',
      'Véhicule électrique',
      'Intéressé',
      'Solution préférée',
      'Horizon',
      'Commentaires',
      'Email',
      'Consentement contact'
    ];

    // Convert to CSV
    const escapeCSV = (value) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvRows = [
      headers.join(','),
      ...responses.map(r => [
        r.id,
        r.created_at,
        r.building,
        r.apartment,
        r.parking_spot,
        r.status,
        r.has_ev,
        r.interested,
        r.preferred_solution,
        r.timeline,
        escapeCSV(r.comments),
        r.email,
        r.consent_contact ? 'Oui' : 'Non'
      ].join(','))
    ];

    const csv = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="enquete-irve-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send('\uFEFF' + csv); // BOM for Excel UTF-8 compatibility
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'export' });
  }
}

router.get('/export', handleExportCSV);

export default router;

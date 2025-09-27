// src/controllers/debtController.js
// Controller pour gérer dettes et créances

const Debt = require('../models/Debt');
const Transaction = require('../models/Transaction');

class DebtController {

    /**
     * POST /api/debts
     * Créer une nouvelle dette ou créance
     */
    static async createDebt(req, res) {
        try {
            const { userId } = req.user;

            const debtData = {
                ...req.body,
                user: userId
            };

            // Calculer montant restant initial
            debtData.amountRemaining = debtData.amount - (debtData.amountPaid || 0);

            // Calculer prochaine échéance si paiements échelonnés
            if (debtData.paymentTerms?.installments) {
                debtData.nextPaymentDue = debtData.borrowedDate || new Date();
            }

            const debt = await Debt.create(debtData);

            res.status(201).json({
                success: true,
                message: `${debt.type === 'debt' ? 'Dette' : 'Créance'} créée avec succès`,
                data: debt
            });

        } catch (error) {
            console.error('Erreur createDebt:', error);
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la création',
                message: error.message
            });
        }
    }

    /**
     * GET /api/debts
     * Lister toutes les dettes/créances de l'utilisateur
     */
    static async getDebts(req, res) {
        try {
            const { userId } = req.user;
            const {
                type,
                status,
                priority,
                includeArchived = 'false'
            } = req.query;

            const filter = { user: userId };

            if (type) filter.type = type;
            if (status) filter.status = status;
            if (priority) filter.priority = priority;
            if (includeArchived === 'false') filter.isArchived = false;

            const debts = await Debt.find(filter)
                .sort({ dueDate: 1, priority: -1 });

            // Statistiques
            const stats = await Debt.getUserStats(userId);

            res.json({
                success: true,
                data: {
                    debts,
                    count: debts.length,
                    statistics: stats
                }
            });

        } catch (error) {
            console.error('Erreur getDebts:', error);
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la récupération',
                message: error.message
            });
        }
    }

    /**
     * GET /api/debts/summary
     * Résumé financier dettes/créances
     */
    static async getSummary(req, res) {
        try {
            const { userId } = req.user;

            const stats = await Debt.getUserStats(userId);

            // Détails par statut
            const byStatus = await Debt.aggregate([
                { $match: { user: userId } },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                        total: { $sum: '$amountRemaining' }
                    }
                }
            ]);

            // Dettes/Créances en retard
            const overdueDebts = await Debt.find({
                user: userId,
                status: { $ne: 'paid' },
                dueDate: { $lt: new Date() }
            }).sort({ dueDate: 1 });

            // Prochaines échéances
            const upcomingPayments = await Debt.find({
                user: userId,
                status: { $ne: 'paid' },
                nextPaymentDue: {
                    $gte: new Date(),
                    $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                }
            }).sort({ nextPaymentDue: 1 });

            res.json({
                success: true,
                data: {
                    overview: stats,
                    byStatus,
                    overdue: {
                        count: overdueDebts.length,
                        items: overdueDebts
                    },
                    upcoming: {
                        count: upcomingPayments.length,
                        items: upcomingPayments
                    }
                }
            });

        } catch (error) {
            console.error('Erreur getSummary:', error);
            res.status(500).json({
                success: false,
                error: 'Erreur lors du calcul du résumé',
                message: error.message
            });
        }
    }

    /**
     * GET /api/debts/:id
     * Détails d'une dette/créance spécifique
     */
    static async getDebtById(req, res) {
        try {
            const { userId } = req.user;
            const { id } = req.params;

            const debt = await Debt.findOne({ _id: id, user: userId });

            if (!debt) {
                return res.status(404).json({
                    success: false,
                    error: 'Dette/Créance introuvable'
                });
            }

            res.json({
                success: true,
                data: debt
            });

        } catch (error) {
            console.error('Erreur getDebtById:', error);
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la récupération',
                message: error.message
            });
        }
    }

    /**
     * PUT /api/debts/:id
     * Modifier une dette/créance
     */
    static async updateDebt(req, res) {
        try {
            const { userId } = req.user;
            const { id } = req.params;

            const debt = await Debt.findOne({ _id: id, user: userId });

            if (!debt) {
                return res.status(404).json({
                    success: false,
                    error: 'Dette/Créance introuvable'
                });
            }

            // Empêcher modification montant si paiements déjà effectués
            if (req.body.amount && debt.payments.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Impossible de modifier le montant après paiements'
                });
            }

            Object.assign(debt, req.body);
            await debt.save();

            res.json({
                success: true,
                message: 'Mise à jour réussie',
                data: debt
            });

        } catch (error) {
            console.error('Erreur updateDebt:', error);
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la mise à jour',
                message: error.message
            });
        }
    }

    /**
     * DELETE /api/debts/:id
     * Supprimer une dette/créance
     */
    static async deleteDebt(req, res) {
        try {
            const { userId } = req.user;
            const { id } = req.params;

            const debt = await Debt.findOneAndDelete({ _id: id, user: userId });

            if (!debt) {
                return res.status(404).json({
                    success: false,
                    error: 'Dette/Créance introuvable'
                });
            }

            res.json({
                success: true,
                message: 'Suppression réussie',
                data: debt
            });

        } catch (error) {
            console.error('Erreur deleteDebt:', error);
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la suppression',
                message: error.message
            });
        }
    }

    /**
     * POST /api/debts/:id/payment
     * Enregistrer un paiement
     */
    static async addPayment(req, res) {
        try {
            const { userId } = req.user;
            const { id } = req.params;
            const { amount, date, paymentMethod, note, createTransaction = true } = req.body;

            const debt = await Debt.findOne({ _id: id, user: userId });

            if (!debt) {
                return res.status(404).json({
                    success: false,
                    error: 'Dette/Créance introuvable'
                });
            }

            // Valider montant
            if (amount <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Montant invalide'
                });
            }

            if (amount > debt.amountRemaining) {
                return res.status(400).json({
                    success: false,
                    error: `Montant supérieur au reste dû (${debt.amountRemaining} ${debt.currency})`
                });
            }

            // Créer transaction associée si demandé
            let transactionId = null;
            if (createTransaction) {
                const transaction = await Transaction.create({
                    user: userId,
                    account: userId,  // ✅ FIX : Utiliser userId comme account temporaire
                    type: debt.type === 'debt' ? 'expense' : 'income',
                    amount: debt.type === 'debt' ? -Math.abs(amount) : Math.abs(amount),
                    currency: debt.currency,
                    category: 'autre',  // ✅ FIX : Utiliser catégorie valide
                    description: `Paiement ${debt.type === 'debt' ? 'dette' : 'créance'} - ${debt.contact.name}`,
                    date: date || new Date(),
                    paymentMethod: paymentMethod || 'cash'
                });
                transactionId = transaction._id;
            }

            // Ajouter paiement
            await debt.addPayment({
                amount,
                date: date || new Date(),
                paymentMethod,
                note,
                transactionReference: transactionId
            });

            res.json({
                success: true,
                message: 'Paiement enregistré',
                data: {
                    debt,
                    amountPaid: debt.amountPaid,
                    amountRemaining: debt.amountRemaining,
                    status: debt.status,
                    percentagePaid: debt.percentagePaid
                }
            });

        } catch (error) {
            console.error('Erreur addPayment:', error);
            res.status(500).json({
                success: false,
                error: 'Erreur lors de l\'enregistrement du paiement',
                message: error.message
            });
        }
    }

    /**
     * GET /api/debts/:id/payments
     * Historique des paiements
     */
    static async getPayments(req, res) {
        try {
            const { userId } = req.user;
            const { id } = req.params;

            const debt = await Debt.findOne({ _id: id, user: userId })
                .populate('payments.transactionReference');

            if (!debt) {
                return res.status(404).json({
                    success: false,
                    error: 'Dette/Créance introuvable'
                });
            }

            res.json({
                success: true,
                data: {
                    payments: debt.payments,
                    totalPaid: debt.amountPaid,
                    totalAmount: debt.amount,
                    remaining: debt.amountRemaining
                }
            });

        } catch (error) {
            console.error('Erreur getPayments:', error);
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la récupération',
                message: error.message
            });
        }
    }

    /**
     * POST /api/debts/:id/reminder
     * Créer un rappel
     */
    static async createReminder(req, res) {
        try {
            const { userId } = req.user;
            const { id } = req.params;
            const { date, type, message } = req.body;

            const debt = await Debt.findOne({ _id: id, user: userId });

            if (!debt) {
                return res.status(404).json({
                    success: false,
                    error: 'Dette/Créance introuvable'
                });
            }

            debt.reminders.push({
                date,
                type,
                message,
                sent: false
            });

            await debt.save();

            res.json({
                success: true,
                message: 'Rappel créé',
                data: debt
            });

        } catch (error) {
            console.error('Erreur createReminder:', error);
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la création du rappel',
                message: error.message
            });
        }
    }

    /**
     * PUT /api/debts/:id/archive
     * Archiver/Désarchiver
     */
    static async toggleArchive(req, res) {
        try {
            const { userId } = req.user;
            const { id } = req.params;

            const debt = await Debt.findOne({ _id: id, user: userId });

            if (!debt) {
                return res.status(404).json({
                    success: false,
                    error: 'Dette/Créance introuvable'
                });
            }

            debt.isArchived = !debt.isArchived;
            await debt.save();

            res.json({
                success: true,
                message: debt.isArchived ? 'Archivée' : 'Désarchivée',
                data: debt
            });

        } catch (error) {
            console.error('Erreur toggleArchive:', error);
            res.status(500).json({
                success: false,
                error: 'Erreur lors de l\'archivage',
                message: error.message
            });
        }
    }

    /**
     * POST /api/debts/:id/calculate-interest
     * Calculer et appliquer intérêts
     */
    static async calculateInterest(req, res) {
        try {
            const { userId } = req.user;
            const { id } = req.params;

            const debt = await Debt.findOne({ _id: id, user: userId });

            if (!debt) {
                return res.status(404).json({
                    success: false,
                    error: 'Dette/Créance introuvable'
                });
            }

            if (!debt.interest.hasInterest) {
                return res.status(400).json({
                    success: false,
                    error: 'Cette dette n\'a pas d\'intérêts'
                });
            }

            const interest = debt.calculateInterest();
            await debt.save();

            res.json({
                success: true,
                message: 'Intérêts calculés',
                data: {
                    interestAmount: interest,
                    totalInterest: debt.interest.totalInterest,
                    amountRemaining: debt.amountRemaining
                }
            });

        } catch (error) {
            console.error('Erreur calculateInterest:', error);
            res.status(500).json({
                success: false,
                error: 'Erreur lors du calcul des intérêts',
                message: error.message
            });
        }
    }
}

module.exports = DebtController;
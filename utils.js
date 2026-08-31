// ============================================
// UTILS.JS - VERSI LENGKAP (FINAL)
// ============================================

// ============================================
// KONSTANTA REPUTASI LEVEL
// ============================================

const REPUTATION_LEVELS = {
    premium: { min: 150, label: '🌟 Premium', dailyLimit: Infinity, badge: 'premium' },
    trusted: { min: 100, label: '✅ Terpercaya', dailyLimit: 10, badge: 'trusted' },
    standard: { min: 60, label: '📝 Standar', dailyLimit: 5, badge: 'standard' },
    improving: { min: 30, label: '⚠️ Perlu Perbaikan', dailyLimit: 2, badge: 'improving' },
    limited: { min: 0, label: '🚫 Terbatas', dailyLimit: 1, badge: 'limited' }
};

// ============================================
// KONFIGURASI LEVEL - LENGKAP
// ============================================

const LEVELS = {
    tamu: {
        name: 'Tamu',
        icon: '🌱',
        description: 'Masih belajar dan menemukan gaya menulis.',
        ktaClass: 'kta-tamu',
        idPrefix: 'Yatta-T',
        nextLevel: 'penulis',
        nextRequirements: {
            onboarding: 1,
            mandatoryMentoring: 2,
            writings: 5
        }
    },
    penulis: {
        name: 'Penulis',
        icon: '✍️',
        description: 'Mulai produktif dan aktif belajar.',
        ktaClass: 'kta-penulis',
        idPrefix: 'Yatta-P',
        nextLevel: 'penulis_profesional',
        nextRequirements: {
            writings: 20,
            books: 1,
            mentoring: 5,
            speakerInternal: 1,
            createMentoring: 3,
            certification: 1
        }
    },
    penulis_profesional: {
        name: 'Penulis Profesional',
        icon: '📚',
        description: 'Penulis mapan dengan portofolio kuat.',
        ktaClass: 'kta-profesional',
        idPrefix: 'Yatta-PP',
        nextLevel: 'mentor',
        nextRequirements: {
            writings: 50,
            books: 3,
            speakerInternal: 5,
            speakerExternal: 3,
            createMentoring: 5,
            certification: 1
        }
    },
    mentor: {
        name: 'Mentor',
        icon: '🌟',
        description: 'Puncak karir literasi, menginspirasi orang lain.',
        ktaClass: 'kta-mentor',
        idPrefix: 'Yatta-M',
        nextLevel: null,
        nextRequirements: null,
        hasSpecialCertification: true
    }
};

// ============================================
// FUNGSI REPUTASI
// ============================================

function getReputationLevel(reputation) {
    if (reputation >= 150) return REPUTATION_LEVELS.premium;
    if (reputation >= 100) return REPUTATION_LEVELS.trusted;
    if (reputation >= 60) return REPUTATION_LEVELS.standard;
    if (reputation >= 30) return REPUTATION_LEVELS.improving;
    return REPUTATION_LEVELS.limited;
}

async function calculateReputation(userId) {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) {
            console.error('❌ Supabase client not available');
            return { reputation: 100, totalWritings: 0, totalViews: 0, totalLikes: 0 };
        }

        const { data: writings, error } = await supabase
            .from('yata_writings')
            .select('views, likes, comments_count, word_count, created_at')
            .eq('author_id', userId)
            .eq('status', 'published');

        if (error) {
            console.error('Error fetching writings:', error);
            return { reputation: 100, totalWritings: 0, totalViews: 0, totalLikes: 0 };
        }

        let reputation = 100;
        let totalWritings = writings?.length || 0;
        let totalViews = 0;
        let totalLikes = 0;

        if (writings && writings.length > 0) {
            writings.forEach(w => {
                totalViews += (w.views || 0);
                totalLikes += (w.likes || 0);
            });

            reputation += Math.min(totalWritings, 20);
            reputation += Math.min(Math.floor(totalViews / 10), 30);
            reputation += Math.min(totalLikes, 30);

            const likeRatio = totalViews > 0 ? (totalLikes / totalViews) * 100 : 0;
            if (likeRatio > 10) reputation += 10;
            if (likeRatio > 20) reputation += 10;

            const avgViews = totalWritings > 0 ? totalViews / totalWritings : 0;
            if (totalWritings > 10 && avgViews < 3) {
                reputation -= 20;
            } else if (totalWritings > 5 && avgViews < 5) {
                reputation -= 10;
            }
        } else {
            reputation -= 2;
        }

        reputation = Math.max(0, Math.min(200, Math.round(reputation)));

        const { error: updateError } = await supabase
            .from('yata_profiles')
            .update({ 
                reputation: reputation,
                total_published: totalWritings,
                total_views_received: totalViews,
                total_likes_received: totalLikes,
                last_reputation_update: new Date().toISOString()
            })
            .eq('id', userId);

        if (updateError) {
            console.error('Error updating reputation:', updateError);
        }

        return { reputation, totalWritings, totalViews, totalLikes };

    } catch (err) {
        console.error('Calculate reputation error:', err);
        return { reputation: 100, totalWritings: 0, totalViews: 0, totalLikes: 0 };
    }
}

async function checkPublishEligibility(userId) {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) {
            return {
                allowed: true,
                remaining: '∞',
                dailyLimit: '∞',
                used: 0,
                reputation: 100,
                level: getReputationLevel(100),
                message: '⚠️ Gagal mengecek reputasi'
            };
        }

        const { data: profile, error } = await supabase
            .from('yata_profiles')
            .select('reputation')
            .eq('id', userId)
            .maybeSingle();

        if (error) {
            console.error('Error fetching profile:', error);
            return {
                allowed: true,
                remaining: '∞',
                dailyLimit: '∞',
                used: 0,
                reputation: 100,
                level: getReputationLevel(100),
                message: '⚠️ Gagal mengecek reputasi'
            };
        }

        const reputation = profile?.reputation || 100;
        const level = getReputationLevel(reputation);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { count, error: countError } = await supabase
            .from('yata_writings')
            .select('*', { count: 'exact', head: true })
            .eq('author_id', userId)
            .eq('status', 'published')
            .gte('created_at', today.toISOString());

        if (countError) {
            console.error('Error counting writings:', countError);
            return {
                allowed: true,
                remaining: '∞',
                dailyLimit: '∞',
                used: 0,
                reputation: reputation,
                level: level,
                message: '⚠️ Gagal menghitung karya'
            };
        }

        const used = count || 0;
        const dailyLimit = level.dailyLimit === Infinity ? Infinity : level.dailyLimit;
        const remaining = dailyLimit === Infinity ? Infinity : dailyLimit - used;
        const allowed = remaining > 0 || dailyLimit === Infinity;

        return {
            allowed: allowed,
            remaining: remaining === Infinity ? '∞' : remaining,
            dailyLimit: dailyLimit === Infinity ? '∞' : dailyLimit,
            used: used,
            reputation: reputation,
            level: level,
            message: allowed 
                ? `✅ Reputasi ${reputation} | Sisa ${remaining === Infinity ? '∞' : remaining} publikasi hari ini`
                : `⚠️ Batas publikasi tercapai (${dailyLimit}/hari). Tingkatkan reputasi untuk kuota lebih banyak!`
        };

    } catch (err) {
        console.error('Check eligibility error:', err);
        return {
            allowed: true,
            remaining: '∞',
            dailyLimit: '∞',
            used: 0,
            reputation: 100,
            level: getReputationLevel(100),
            message: '⚠️ Gagal mengecek reputasi'
        };
    }
}

// ============================================
// FUNGSI GET SUPABASE CLIENT
// ============================================

function getSupabaseClient() {
    if (typeof _supabase !== 'undefined') {
        return _supabase;
    }
    if (typeof window !== 'undefined' && window._supabase) {
        return window._supabase;
    }
    if (typeof window !== 'undefined' && window.supabase) {
        return window.supabase;
    }
    console.warn('⚠️ Supabase client not available');
    return null;
}

// ============================================
// HELPER: Ambil Level Key dari Nama Level
// ============================================

function getLevelKey(levelName) {
    const map = {
        'Tamu': 'tamu',
        'Penulis': 'penulis',
        'Penulis Profesional': 'penulis_profesional',
        'Mentor': 'mentor'
    };
    return map[levelName] || 'tamu';
}

// ============================================
// HELPER: Ambil Nama Level dari Level Key
// ============================================

function getLevelName(levelKey) {
    const map = {
        'tamu': 'Tamu',
        'penulis': 'Penulis',
        'penulis_profesional': 'Penulis Profesional',
        'mentor': 'Mentor'
    };
    return map[levelKey] || 'Tamu';
}

// ============================================
// 🔥 CEK SYARAT NAIK LEVEL - DIPERBAIKI (VERSI FINAL)
// ============================================

async function checkLevelUpRequirements(userId) {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) {
            console.error('❌ Supabase client not available');
            return {
                canLevelUp: false,
                requirements: {},
                details: [],
                message: '❌ Gagal mengecek syarat'
            };
        }

        // 1. Ambil profil user
        const { data: profile, error: profileError } = await supabase
            .from('yata_profiles')
            .select('member_level, level_status, rejection_reason, created_at')
            .eq('id', userId)
            .single();

        if (profileError) throw profileError;

        const currentLevelKey = getLevelKey(profile.member_level);
        const currentLevel = LEVELS[currentLevelKey];
        
        if (!currentLevel || !currentLevel.nextLevel) {
            return {
                canLevelUp: false,
                requirements: {},
                details: [],
                message: '🏆 Anda sudah di level tertinggi!',
                isMaxLevel: true
            };
        }

        const targetLevel = currentLevel.nextLevel;
        const req = currentLevel.nextRequirements;
        
        if (!req) {
            return {
                canLevelUp: false,
                requirements: {},
                details: [],
                message: '❌ Data syarat tidak ditemukan'
            };
        }

        // ============================================
        // 🔥 QUERY 1: Ambil semua partisipasi mentoring (tanpa join!)
        // ============================================
        const { data: participants, error: partError } = await supabase
            .from('yata_mentoring_participants')
            .select('session_id, attended')
            .eq('user_id', userId)
            .eq('attended', true);

        if (partError) {
            console.error('❌ Error get participants:', partError);
        }

        const participantSessions = participants || [];
        console.log(`📊 Total attended mentoring: ${participantSessions.length}`);

        // 🔥 QUERY 2: Ambil detail session dari session_id yang didapat
        let sessionDetails = [];
        if (participantSessions.length > 0) {
            const sessionIds = participantSessions.map(p => p.session_id);
            
            const { data: sessions, error: sessionError } = await supabase
                .from('yata_mentoring_sessions')
                .select('id, is_onboarding, is_mandatory')
                .in('id', sessionIds);

            if (!sessionError && sessions) {
                sessionDetails = sessions;
            }
        }

        console.log('📊 Session details:', sessionDetails);

        // 🔥 HITUNG MENTORING
        const onboardingCount = sessionDetails.filter(s => s.is_onboarding === true).length;
        const mandatoryCount = sessionDetails.filter(s => 
            s.is_onboarding === false && s.is_mandatory === true
        ).length;
        const totalMentoringCount = onboardingCount + mandatoryCount;

        console.log(`📊 Onboarding: ${onboardingCount}, Mandatory: ${mandatoryCount}, Total: ${totalMentoringCount}`);

        // 🔥 QUERY 3: Ambil karya published
        const { count: totalWritings, error: wError } = await supabase
            .from('yata_writings')
            .select('*', { count: 'exact', head: true })
            .eq('author_id', userId)
            .eq('status', 'published');

        if (wError) {
            console.error('❌ Error count writings:', wError);
        }

        console.log(`📊 Writings: ${totalWritings || 0}`);

        // 🔥 QUERY 4: Buku published
        const { data: booksData, error: bError } = await supabase
            .from('yata_book_projects')
            .select('id')
            .eq('author_id', userId)
            .eq('status', 'published');

        if (bError) {
            console.error('❌ Error get books:', bError);
        }

        console.log(`📊 Books: ${booksData?.length || 0}`);

        // 🔥 QUERY 5: Speaker events
        const { data: speakerEvents, error: sError } = await supabase
            .from('yata_speaker_events')
            .select('event_type')
            .eq('user_id', userId)
            .eq('status', 'approved');

        if (sError) {
            console.error('❌ Error get speaker events:', sError);
        }

        // 🔥 QUERY 6: Create mentoring
        const { data: createdMentoring, error: cmError } = await supabase
            .from('yata_mentoring_sessions')
            .select('id')
            .eq('mentor_id', userId)
            .eq('is_onboarding', false)
            .eq('is_mandatory', false)
            .eq('is_mentor_created', true);

        if (cmError) {
            console.error('❌ Error get created mentoring:', cmError);
        }

        // 🔥 QUERY 7: Sertifikasi
        const { count: certCount, error: cError } = await supabase
            .from('yata_certifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('is_active', true);

        if (cError) {
            console.error('❌ Error get certifications:', cError);
        }

        // ============================================
        // HASIL AKHIR
        // ============================================
        const result = {
            onboardingCount: onboardingCount,
            mandatoryMentoringCount: mandatoryCount,
            totalMentoringCount: totalMentoringCount,
            writingsCount: totalWritings || 0,
            booksCount: booksData?.length || 0,
            mentoringCount: participantSessions.length,
            speakerInternalCount: (speakerEvents || []).filter(e => e.event_type === 'internal').length,
            speakerExternalCount: (speakerEvents || []).filter(e => e.event_type === 'external').length,
            createMentoringCount: createdMentoring?.length || 0,
            certificationCount: certCount || 0
        };

        console.log('📊 Final Result:', result);

        // ============================================
        // CEK SYARAT
        // ============================================
        let canLevelUp = true;
        const requirementStatus = {};
        const details = [];

        // 🔥 SYARAT UNTUK TAMU → PENULIS
        if (currentLevelKey === 'tamu') {
            const onboardingMet = result.onboardingCount >= 1;
            requirementStatus.onboarding = onboardingMet;
            if (!onboardingMet) canLevelUp = false;
            details.push({
                key: 'onboarding',
                label: 'Onboarding YATTA',
                current: result.onboardingCount,
                target: 1,
                met: onboardingMet,
                icon: '🎓'
            });

            const mandatoryMet = result.mandatoryMentoringCount >= 2;
            requirementStatus.mandatoryMentoring = mandatoryMet;
            if (!mandatoryMet) canLevelUp = false;
            details.push({
                key: 'mandatoryMentoring',
                label: 'Mentoring Admin (Wajib)',
                current: result.mandatoryMentoringCount,
                target: 2,
                met: mandatoryMet,
                icon: '📖'
            });

            const writingsMet = result.writingsCount >= 5;
            requirementStatus.writings = writingsMet;
            if (!writingsMet) canLevelUp = false;
            details.push({
                key: 'writings',
                label: 'Karya Dipublikasikan',
                current: result.writingsCount,
                target: 5,
                met: writingsMet,
                icon: '✍️'
            });
        } 
        // 🔥 SYARAT UNTUK PENULIS → PENULIS PROFESIONAL
        else if (currentLevelKey === 'penulis') {
            const writingsMet = result.writingsCount >= 20;
            requirementStatus.writings = writingsMet;
            if (!writingsMet) canLevelUp = false;
            details.push({
                key: 'writings',
                label: 'Karya (di luar level Tamu)',
                current: result.writingsCount,
                target: 20,
                met: writingsMet,
                icon: '✍️'
            });

            const booksMet = result.booksCount >= 1;
            requirementStatus.books = booksMet;
            if (!booksMet) canLevelUp = false;
            details.push({
                key: 'books',
                label: 'Buku Diterbitkan (ISBN/QRCBN)',
                current: result.booksCount,
                target: 1,
                met: booksMet,
                icon: '📚'
            });

            const mentoringMet = result.totalMentoringCount >= 5;
            requirementStatus.mentoring = mentoringMet;
            if (!mentoringMet) canLevelUp = false;
            details.push({
                key: 'mentoring',
                label: 'Mentoring (di luar level Tamu)',
                current: result.totalMentoringCount,
                target: 5,
                met: mentoringMet,
                icon: '🎓'
            });

            const speakerInternalMet = result.speakerInternalCount >= 1;
            requirementStatus.speakerInternal = speakerInternalMet;
            if (!speakerInternalMet) canLevelUp = false;
            details.push({
                key: 'speakerInternal',
                label: 'Pembicara Internal YATTA',
                current: result.speakerInternalCount,
                target: 1,
                met: speakerInternalMet,
                icon: '🎤'
            });

            const createMentoringMet = result.createMentoringCount >= 3;
            requirementStatus.createMentoring = createMentoringMet;
            if (!createMentoringMet) canLevelUp = false;
            details.push({
                key: 'createMentoring',
                label: 'Membuat Kelas Mentoring',
                current: result.createMentoringCount,
                target: 3,
                met: createMentoringMet,
                icon: '📝'
            });

            const certMet = result.certificationCount >= 1;
            requirementStatus.certification = certMet;
            if (!certMet) canLevelUp = false;
            details.push({
                key: 'certification',
                label: 'Training Sertifikasi Penulis',
                current: result.certificationCount,
                target: 1,
                met: certMet,
                icon: '📜'
            });
        }
        // 🔥 SYARAT UNTUK PENULIS PROFESIONAL → MENTOR
        else if (currentLevelKey === 'penulis_profesional') {
            const writingsMet = result.writingsCount >= 50;
            requirementStatus.writings = writingsMet;
            if (!writingsMet) canLevelUp = false;
            details.push({
                key: 'writings',
                label: 'Karya (di luar level Profesional)',
                current: result.writingsCount,
                target: 50,
                met: writingsMet,
                icon: '✍️'
            });

            const booksMet = result.booksCount >= 3;
            requirementStatus.books = booksMet;
            if (!booksMet) canLevelUp = false;
            details.push({
                key: 'books',
                label: 'Buku Diterbitkan (di luar level Profesional)',
                current: result.booksCount,
                target: 3,
                met: booksMet,
                icon: '📚'
            });

            const speakerInternalMet = result.speakerInternalCount >= 5;
            requirementStatus.speakerInternal = speakerInternalMet;
            if (!speakerInternalMet) canLevelUp = false;
            details.push({
                key: 'speakerInternal',
                label: 'Pembicara Internal YATTA',
                current: result.speakerInternalCount,
                target: 5,
                met: speakerInternalMet,
                icon: '🎤'
            });

            const speakerExternalMet = result.speakerExternalCount >= 3;
            requirementStatus.speakerExternal = speakerExternalMet;
            if (!speakerExternalMet) canLevelUp = false;
            details.push({
                key: 'speakerExternal',
                label: 'Pembicara Eksternal',
                current: result.speakerExternalCount,
                target: 3,
                met: speakerExternalMet,
                icon: '🌟'
            });

            const createMentoringMet = result.createMentoringCount >= 5;
            requirementStatus.createMentoring = createMentoringMet;
            if (!createMentoringMet) canLevelUp = false;
            details.push({
                key: 'createMentoring',
                label: 'Membuat Kelas Mentoring',
                current: result.createMentoringCount,
                target: 5,
                met: createMentoringMet,
                icon: '📝'
            });

            const certMet = result.certificationCount >= 1;
            requirementStatus.certification = certMet;
            if (!certMet) canLevelUp = false;
            details.push({
                key: 'certification',
                label: 'Training Sertifikasi Penulis Profesional',
                current: result.certificationCount,
                target: 1,
                met: certMet,
                icon: '📜'
            });
        }
        // 🔥 FALLBACK UNTUK LEVEL LAIN
        else {
            if (req.onboarding !== undefined) {
                const met = result.onboardingCount >= req.onboarding;
                requirementStatus.onboarding = met;
                if (!met) canLevelUp = false;
                details.push({
                    key: 'onboarding',
                    label: 'Onboarding',
                    current: result.onboardingCount,
                    target: req.onboarding,
                    met: met,
                    icon: '🎓'
                });
            }

            if (req.mandatoryMentoring !== undefined) {
                const met = result.mandatoryMentoringCount >= req.mandatoryMentoring;
                requirementStatus.mandatoryMentoring = met;
                if (!met) canLevelUp = false;
                details.push({
                    key: 'mandatoryMentoring',
                    label: 'Mentoring Admin (Wajib)',
                    current: result.mandatoryMentoringCount,
                    target: req.mandatoryMentoring,
                    met: met,
                    icon: '📖'
                });
            }

            if (req.writings !== undefined) {
                const met = result.writingsCount >= req.writings;
                requirementStatus.writings = met;
                if (!met) canLevelUp = false;
                details.push({
                    key: 'writings',
                    label: 'Karya',
                    current: result.writingsCount,
                    target: req.writings,
                    met: met,
                    icon: '✍️'
                });
            }

            if (req.books !== undefined) {
                const met = result.booksCount >= req.books;
                requirementStatus.books = met;
                if (!met) canLevelUp = false;
                details.push({
                    key: 'books',
                    label: 'Buku (ISBN/QRCBN)',
                    current: result.booksCount,
                    target: req.books,
                    met: met,
                    icon: '📚'
                });
            }

            if (req.mentoring !== undefined) {
                const met = result.totalMentoringCount >= req.mentoring;
                requirementStatus.mentoring = met;
                if (!met) canLevelUp = false;
                details.push({
                    key: 'mentoring',
                    label: 'Mentoring',
                    current: result.totalMentoringCount,
                    target: req.mentoring,
                    met: met,
                    icon: '🎓'
                });
            }

            if (req.speakerInternal !== undefined) {
                const met = result.speakerInternalCount >= req.speakerInternal;
                requirementStatus.speakerInternal = met;
                if (!met) canLevelUp = false;
                details.push({
                    key: 'speakerInternal',
                    label: 'Pembicara Internal YATTA',
                    current: result.speakerInternalCount,
                    target: req.speakerInternal,
                    met: met,
                    icon: '🎤'
                });
            }

            if (req.speakerExternal !== undefined) {
                const met = result.speakerExternalCount >= req.speakerExternal;
                requirementStatus.speakerExternal = met;
                if (!met) canLevelUp = false;
                details.push({
                    key: 'speakerExternal',
                    label: 'Pembicara Eksternal',
                    current: result.speakerExternalCount,
                    target: req.speakerExternal,
                    met: met,
                    icon: '🌟'
                });
            }

            if (req.createMentoring !== undefined) {
                const met = result.createMentoringCount >= req.createMentoring;
                requirementStatus.createMentoring = met;
                if (!met) canLevelUp = false;
                details.push({
                    key: 'createMentoring',
                    label: 'Membuat Kelas Mentoring',
                    current: result.createMentoringCount,
                    target: req.createMentoring,
                    met: met,
                    icon: '📝'
                });
            }

            if (req.certification !== undefined) {
                const met = result.certificationCount >= req.certification;
                requirementStatus.certification = met;
                if (!met) canLevelUp = false;
                details.push({
                    key: 'certification',
                    label: 'Sertifikasi',
                    current: result.certificationCount,
                    target: req.certification,
                    met: met,
                    icon: '📜'
                });
            }
        }

        const targetLevelName = getLevelName(targetLevel);
        const message = canLevelUp ? 
            `✅ Semua syarat terpenuhi! Ajukan naik ke "${targetLevelName}" sekarang.` :
            `📋 ${details.filter(d => !d.met).map(d => `${d.label}: ${d.current}/${d.target}`).join(' • ')}`;

        return {
            canLevelUp: canLevelUp,
            requirements: requirementStatus,
            details: details,
            currentLevel: currentLevelKey,
            targetLevel: targetLevel,
            targetLevelName: targetLevelName,
            message: message,
            isMaxLevel: false,
            ...result
        };

    } catch (err) {
        console.error('❌ Check level requirements error:', err);
        return {
            canLevelUp: false,
            requirements: {},
            details: [],
            message: '❌ Gagal mengecek syarat: ' + err.message,
            isMaxLevel: false
        };
    }
}

// ============================================
// 🔥 GET LEVEL PROGRESS
// ============================================

function getLevelProgress(levelKey, requirements) {
    const level = LEVELS[levelKey];
    
    if (!level || !level.nextLevel) {
        return {
            progress: 100,
            text: '🏆 Anda sudah di level tertinggi!',
            details: [],
            nextLevelName: null,
            nextLevelIcon: null
        };
    }

    const req = level.nextRequirements;
    if (!req) {
        return {
            progress: 100,
            text: '🏆 Anda sudah di level tertinggi!',
            details: [],
            nextLevelName: null,
            nextLevelIcon: null
        };
    }

    const detailItems = requirements.details || [];
    const total = detailItems.length;
    const achieved = detailItems.filter(d => d.met).length;
    const progress = total > 0 ? Math.round((achieved / total) * 100) : 0;

    const nextLevel = LEVELS[level.nextLevel];
    const nextLevelName = nextLevel ? nextLevel.name : 'Level Tertinggi';
    const nextLevelIcon = nextLevel ? nextLevel.icon : '🏆';

    const summary = detailItems.map(d => 
        `${d.current}/${d.target} ${d.label}`
    ).join(' • ');

    return {
        progress: Math.min(progress, 100),
        text: summary || 'Semua syarat terpenuhi!',
        details: detailItems,
        nextLevelName: nextLevelName,
        nextLevelIcon: nextLevelIcon
    };
}

// ============================================
// 🔥 UPDATE UI LEVEL
// ============================================

async function updateLevelUI(userId) {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) return null;

        const { data: profile, error: profileError } = await supabase
            .from('yata_profiles')
            .select('member_level, level_status, rejection_reason')
            .eq('id', userId)
            .single();

        if (profileError) throw profileError;

        // 🔥 OTOMATIS: Reset level_status jika status approved tapi sudah mencapai level
        if (profile.level_status === 'approved') {
            const { data: history, error: histError } = await supabase
                .from('yata_level_history')
                .select('new_level')
                .eq('user_id', userId)
                .eq('status', 'approved')
                .order('created_at', { ascending: false })
                .limit(1);

            if (!histError && history && history.length > 0) {
                if (history[0].new_level === profile.member_level) {
                    await supabase
                        .from('yata_profiles')
                        .update({ level_status: null })
                        .eq('id', userId);
                    // Refresh profile
                    const { data: fresh } = await supabase
                        .from('yata_profiles')
                        .select('level_status')
                        .eq('id', userId)
                        .single();
                    if (fresh) profile.level_status = fresh.level_status;
                }
            }
        }

        const requirements = await checkLevelUpRequirements(userId);
        const currentLevelKey = getLevelKey(profile.member_level);
        const progress = getLevelProgress(currentLevelKey, requirements);

        // Update Progress Bar
        const progressBar = document.getElementById('levelProgressBar');
        const progressLabel = document.getElementById('levelProgressText');
        const nextInfo = document.getElementById('levelNextInfo');

        if (progressBar) {
            progressBar.style.width = progress.progress + '%';
            if (progress.progress >= 100) {
                progressBar.className = 'bg-emerald-600 h-2.5 rounded-full transition-all duration-500';
            } else if (progress.progress >= 50) {
                progressBar.className = 'bg-yellow-500 h-2.5 rounded-full transition-all duration-500';
            } else {
                progressBar.className = 'bg-amber-500 h-2.5 rounded-full transition-all duration-500';
            }
        }
        if (progressLabel) {
            progressLabel.textContent = progress.progress + '%';
        }
        if (nextInfo) {
            nextInfo.textContent = progress.text || 'Semua syarat terpenuhi!';
        }

        // Update Detail Progress
        const detailsContainer = document.getElementById('progressDetails');
        if (detailsContainer && progress.details) {
            let html = '';
            for (let i = 0; i < progress.details.length; i++) {
                const item = progress.details[i];
                const statusClass = item.met ? 'done' : 'incomplete';
                const statusText = item.met ? '✅ Selesai' : '⏳ Belum';
                html += `
                    <div class="progress-item">
                        <span class="icon">${item.icon}</span>
                        <span class="label">${item.label}</span>
                        <span class="text-xs font-bold text-yellow-400">${item.current}</span>
                        <span class="text-xs text-white/30">/</span>
                        <span class="text-xs font-medium text-white/50">${item.target}</span>
                        <span class="status ${statusClass}">${statusText}</span>
                    </div>
                `;
            }
            detailsContainer.innerHTML = html;
        }

        // Update Tombol
        await updateLevelUpButtonUI(userId, requirements, profile);

        // Update info level
        const levelNameEl = document.getElementById('levelName');
        const levelIconEl = document.getElementById('levelIcon');
        if (levelNameEl) levelNameEl.textContent = profile.member_level || 'Tamu';
        if (levelIconEl) levelIconEl.textContent = LEVELS[currentLevelKey]?.icon || '🌱';

        // Update Big Level
        const bigLevelName = document.getElementById('levelBigName');
        const bigLevelIcon = document.getElementById('levelBigIcon');
        const bigLevelDesc = document.getElementById('levelBigDesc');
        if (bigLevelName) bigLevelName.textContent = profile.member_level || 'Tamu';
        if (bigLevelIcon) bigLevelIcon.textContent = LEVELS[currentLevelKey]?.icon || '🌱';
        if (bigLevelDesc) bigLevelDesc.textContent = LEVELS[currentLevelKey]?.description || 'Masih belajar dan menemukan gaya menulis.';

        // Update Level Status Badge di Profile
        const statusBadge = document.getElementById('profileLevelStatus');
        if (statusBadge) {
            if (profile.level_status === 'pending') {
                statusBadge.textContent = '⏳ Menunggu Verifikasi Admin';
                statusBadge.className = 'level-status-badge level-status-pending';
                statusBadge.classList.remove('hidden');
            } else if (profile.level_status === 'approved') {
                statusBadge.textContent = '✅ Level Disetujui!';
                statusBadge.className = 'level-status-badge level-status-approved';
                statusBadge.classList.remove('hidden');
            } else if (profile.level_status === 'rejected') {
                statusBadge.textContent = '❌ Ditolak';
                statusBadge.className = 'level-status-badge level-status-rejected';
                statusBadge.classList.remove('hidden');
                const rejectContainer = document.getElementById('rejectionReasonContainer');
                const rejectText = document.getElementById('rejectionReasonText');
                if (rejectContainer && rejectText) {
                    rejectContainer.classList.remove('hidden');
                    rejectText.textContent = profile.rejection_reason || 'Belum memenuhi syarat publikasi.';
                }
            } else if (requirements.canLevelUp) {
                statusBadge.textContent = '✅ Syarat Terpenuhi!';
                statusBadge.className = 'level-status-badge level-status-approved';
                statusBadge.classList.remove('hidden');
            } else {
                statusBadge.textContent = '⏳ Syarat Belum Terpenuhi';
                statusBadge.className = 'level-status-badge level-status-pending';
                statusBadge.classList.remove('hidden');
            }
        }

        // Update Profile Level Progress (khusus profile.html)
        const progressIcon = document.getElementById('levelProgressIcon');
        const currentName = document.getElementById('currentLevelName');
        const nextName = document.getElementById('nextLevelName');
        const progressPercent = document.getElementById('levelProgressPercent');
        const progressSummary = document.getElementById('levelProgressSummary');

        if (progressIcon) progressIcon.textContent = LEVELS[currentLevelKey]?.icon || '🌱';
        if (currentName) currentName.textContent = profile.member_level || 'Tamu';
        if (nextName) nextName.textContent = progress.nextLevelName || 'Level Tertinggi';
        if (progressPercent) progressPercent.textContent = progress.progress + '%';
        if (progressSummary) progressSummary.textContent = progress.text || 'Semua syarat terpenuhi!';

        return { requirements, progress };

    } catch (err) {
        console.error('❌ Update Level UI Error:', err);
        return null;
    }
}

// ============================================
// 🔥 UPDATE TOMBOL NAIK LEVEL
// ============================================

async function updateLevelUpButtonUI(userId, requirements, profile) {
    const btn = document.getElementById('btnLevelUp');
    const statusEl = document.getElementById('levelUpStatus');
    if (!btn) return;

    btn.disabled = false;
    btn.className = 'w-full bg-yellow-400 hover:bg-yellow-300 text-emerald-900 font-bold py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-2';

    const levelStatus = profile?.level_status || '';

    if (levelStatus === 'pending') {
        btn.disabled = true;
        btn.innerHTML = '⏳ Menunggu Verifikasi';
        btn.className = 'w-full bg-yellow-400 text-emerald-900 font-bold py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-2 cursor-not-allowed';
        if (statusEl) {
            statusEl.textContent = '⏳ Pengajuan Anda sedang diproses admin.';
            statusEl.className = 'text-xs text-yellow-600 mt-1 text-center block';
        }
        return;
    }

    if (levelStatus === 'approved') {
        btn.disabled = true;
        btn.innerHTML = '✅ Level Disetujui!';
        btn.className = 'w-full bg-emerald-400 text-white font-bold py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-2 cursor-not-allowed';
        if (statusEl) {
            statusEl.textContent = '✅ Selamat! Level Anda sudah naik.';
            statusEl.className = 'text-xs text-emerald-600 mt-1 text-center block';
        }
        return;
    }

    if (levelStatus === 'rejected') {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-arrow-up"></i> Ajukan Naik Level';
        if (statusEl) {
            const reason = profile?.rejection_reason || 'Belum memenuhi syarat.';
            statusEl.textContent = '❌ Pengajuan ditolak. ' + reason;
            statusEl.className = 'text-xs text-red-600 mt-1 text-center block';
        }
        return;
    }

    if (requirements?.canLevelUp) {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-arrow-up"></i> Ajukan Naik Level ke "${requirements.targetLevelName || 'Penulis'}"`;
        if (statusEl) {
            statusEl.textContent = '✅ Semua syarat terpenuhi!';
            statusEl.className = 'text-xs text-emerald-600 mt-1 text-center block';
        }
    } else if (requirements?.isMaxLevel) {
        btn.disabled = true;
        btn.innerHTML = '🏆 Level Tertinggi!';
        btn.className = 'w-full bg-amber-400 text-amber-900 font-bold py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-2 cursor-not-allowed';
        if (statusEl) {
            statusEl.textContent = '🌟 Anda sudah mencapai puncak karir literasi!';
            statusEl.className = 'text-xs text-amber-600 mt-1 text-center block';
        }
    } else {
        btn.disabled = true;
        btn.innerHTML = '🔒 Syarat Belum Terpenuhi';
        btn.className = 'w-full bg-slate-300 text-slate-500 font-bold py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-2 cursor-not-allowed';
        if (statusEl) {
            const missing = requirements?.details?.filter(d => !d.met) || [];
            const summary = missing.map(d => `${d.label}: ${d.current}/${d.target}`).join(' • ');
            statusEl.textContent = `⚠️ ${summary || 'Selesaikan semua syarat'}`;
            statusEl.className = 'text-xs text-amber-600 mt-1 text-center block';
        }
    }
}

// ============================================
// 🔥 AJUKAN NAIK LEVEL
// ============================================

async function submitLevelUpRequest() {
    const btn = document.getElementById('btnLevelUp');
    const statusEl = document.getElementById('levelUpStatus');
    
    if (statusEl) {
        statusEl.className = 'text-xs text-slate-500 mt-1 text-center hidden';
    }
    
    try {
        const supabase = getSupabaseClient();
        if (!supabase) {
            if (statusEl) {
                statusEl.textContent = 'Gagal terhubung ke server.';
                statusEl.className = 'text-xs text-red-500 mt-1 text-center block';
            }
            return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            if (statusEl) {
                statusEl.textContent = 'Silakan login terlebih dahulu.';
                statusEl.className = 'text-xs text-red-500 mt-1 text-center block';
            }
            return;
        }

        const userId = session.user.id;

        const { data: profile, error: profileError } = await supabase
            .from('yata_profiles')
            .select('member_level, level_status, rejection_reason')
            .eq('id', userId)
            .single();

        if (profileError) {
            if (statusEl) {
                statusEl.textContent = 'Gagal memuat data profil.';
                statusEl.className = 'text-xs text-red-400 mt-1 text-center block';
            }
            return;
        }

        if (profile.level_status === 'pending') {
            if (statusEl) {
                statusEl.textContent = '⏳ Pengajuan Anda sedang diproses oleh admin.';
                statusEl.className = 'text-xs text-yellow-600 mt-1 text-center block';
            }
            return;
        }

        if (profile.level_status === 'approved') {
            if (statusEl) {
                statusEl.textContent = '✅ Pengajuan Anda sudah disetujui!';
                statusEl.className = 'text-xs text-emerald-600 mt-1 text-center block';
            }
            return;
        }

        const requirements = await checkLevelUpRequirements(userId);
        
        if (!requirements.canLevelUp) {
            if (statusEl) {
                const missing = requirements.details?.filter(d => !d.met) || [];
                const summary = missing.map(d => `${d.label}: ${d.current}/${d.target}`).join(' • ');
                statusEl.textContent = `⚠️ Syarat belum terpenuhi. ${summary}`;
                statusEl.className = 'text-xs text-amber-600 mt-1 text-center block';
            }
            return;
        }

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Mengirim...';
        }

        const targetLevel = requirements.targetLevelName || 'Penulis';
        const currentLevel = profile.member_level || 'Tamu';

        // Catat history
        await supabase
            .from('yata_level_history')
            .insert([{
                user_id: userId,
                old_level: currentLevel,
                new_level: targetLevel,
                status: 'pending',
                created_at: new Date().toISOString()
            }]);

        // Notifikasi ke admin
        const { data: admins } = await supabase
            .from('yata_profiles')
            .select('id')
            .eq('role', 'admin');

        if (admins && admins.length > 0) {
            const detailSummary = requirements.details?.map(d => 
                `${d.icon} ${d.label}: ${d.current}/${d.target} ${d.met ? '✅' : '❌'}`
            ).join('\n') || '';

            const notifContent = `📢 Member mengajukan naik level.

📊 Data:
- Level saat ini: ${currentLevel}
- Target: ${targetLevel}
- User: ${session.user.email || userId}

📋 Syarat:
${detailSummary}

📌 Silakan verifikasi pengajuan ini.`;

            const { data: notifData, error: notifError } = await supabase
                .from('yata_notifications')
                .insert([{
                    title: '📢 Pengajuan Naik Level',
                    content: notifContent,
                    type: 'campaign'
                }])
                .select()
                .single();

            if (!notifError && notifData) {
                const entries = admins.map(admin => ({
                    notification_id: notifData.id,
                    user_id: admin.id,
                    is_read: false
                }));
                await supabase
                    .from('yata_user_notifications')
                    .insert(entries);
            }
        }

        // Update status
        await supabase
            .from('yata_profiles')
            .update({ 
                level_status: 'pending',
                updated_at: new Date().toISOString()
            })
            .eq('id', userId);

        // Notifikasi ke user
        await sendNotification(
            userId,
            '⭐ Pengajuan Naik Level Dikirim!',
            `Pengajuan naik level dari "${currentLevel}" ke "${targetLevel}" telah dikirim ke admin. Mohon tunggu verifikasi.`,
            'campaign'
        );

        if (statusEl) {
            statusEl.textContent = `✅ Pengajuan naik level ke "${targetLevel}" telah dikirim ke admin!`;
            statusEl.className = 'text-xs text-emerald-600 mt-1 text-center block';
        }
        if (btn) {
            btn.innerHTML = '✅ Terkirim!';
        }

        setTimeout(() => {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-arrow-up"></i> Ajukan Naik Level';
            }
            if (typeof updateLevelUI === 'function') {
                updateLevelUI(userId);
            }
        }, 3000);

    } catch (err) {
        console.error('Submit level up error:', err);
        if (statusEl) {
            statusEl.textContent = '❌ Gagal mengajukan: ' + err.message;
            statusEl.className = 'text-xs text-red-400 mt-1 text-center block';
        }
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-arrow-up"></i> Ajukan Naik Level';
        }
    }
}

// ============================================
// 🔥 APPROVE / REJECT LEVEL UP (UNTUK ADMIN)
// ============================================

async function approveLevelUp(userId) {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) return false;

        const { data: profile, error: profileError } = await supabase
            .from('yata_profiles')
            .select('member_level, member_id')
            .eq('id', userId)
            .single();

        if (profileError) throw profileError;

        const currentLevelKey = getLevelKey(profile.member_level);
        const currentLevel = LEVELS[currentLevelKey];
        
        if (!currentLevel || !currentLevel.nextLevel) {
            throw new Error('Tidak ada level selanjutnya');
        }

        const targetLevelName = getLevelName(currentLevel.nextLevel);
        const targetLevelKey = currentLevel.nextLevel;
        const targetLevel = LEVELS[targetLevelKey];

        // 🔥 UPDATE MEMBER ID DENGAN PREFIX BARU (NOMOR & TANGGAL TETAP)
        let newMemberId = profile.member_id;
        
        if (profile.member_id && profile.member_id !== 'undefined' && profile.member_id !== 'null') {
            const parts = profile.member_id.split('-');
            if (parts.length === 3) {
                const idPart = parts[2];
                const datePart = idPart.slice(-6);
                const numberPart = idPart.substring(0, idPart.length - 6);
                newMemberId = targetLevel.idPrefix + '-' + numberPart + datePart;
            }
        } else {
            const now = new Date();
            const tanggal = String(now.getDate()).padStart(2, '0');
            const bulan = String(now.getMonth() + 1).padStart(2, '0');
            const tahun = String(now.getFullYear()).slice(-2);
            const dateSuffix = tanggal + bulan + tahun;
            
            const { count } = await supabase
                .from('yata_profiles')
                .select('*', { count: 'exact', head: true });
            const nextNumber = (count || 0) + 1;
            
            newMemberId = targetLevel.idPrefix + '-' + nextNumber + dateSuffix;
        }

        await supabase
            .from('yata_profiles')
            .update({
                member_level: targetLevelName,
                level_status: 'approved',
                member_id: newMemberId,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId);

        await supabase
            .from('yata_level_history')
            .update({
                status: 'approved',
                approved_at: new Date().toISOString()
            })
            .eq('user_id', userId)
            .eq('new_level', targetLevelName)
            .eq('status', 'pending');

        await sendNotification(
            userId,
            '🎉 Selamat! Level Anda Naik!',
            `Selamat! Level Anda telah naik dari "${profile.member_level}" menjadi "${targetLevelName}".\n\n🆔 ID Anggota baru Anda: ${newMemberId}\n\nTerus berkarya dan tingkatkan potensi Anda!`,
            'success'
        );

        return true;

    } catch (err) {
        console.error('Approve level up error:', err);
        return false;
    }
}

async function rejectLevelUp(userId, reason) {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) return false;

        await supabase
            .from('yata_profiles')
            .update({
                level_status: 'rejected',
                rejection_reason: reason,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId);

        await supabase
            .from('yata_level_history')
            .update({
                status: 'rejected',
                rejection_reason: reason,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId)
            .eq('status', 'pending');

        await sendNotification(
            userId,
            '❌ Pengajuan Naik Level Ditolak',
            `Pengajuan naik level Anda ditolak dengan alasan: ${reason}`,
            'warning'
        );

        return true;

    } catch (err) {
        console.error('Reject level up error:', err);
        return false;
    }
}

// ============================================
// 🔥 GENERATE MEMBER ID - FORMAT BARU
// ============================================

async function generateMemberId(levelKey) {
    const prefixMap = {
        'tamu': 'Yatta-T',
        'penulis': 'Yatta-P',
        'penulis_profesional': 'Yatta-PP',
        'mentor': 'Yatta-M'
    };
    
    const prefix = prefixMap[levelKey] || 'Yatta-T';
    
    const now = new Date();
    const tanggal = String(now.getDate()).padStart(2, '0');
    const bulan = String(now.getMonth() + 1).padStart(2, '0');
    const tahun = String(now.getFullYear()).slice(-2);
    const dateSuffix = `${tanggal}${bulan}${tahun}`;
    
    try {
        const supabase = getSupabaseClient();
        if (!supabase) {
            return `${prefix}-1${dateSuffix}`;
        }

        const { data, error } = await supabase
            .from('yata_profiles')
            .select('member_id')
            .ilike('member_id', `%${dateSuffix}`);

        if (error) {
            console.error('Error counting members:', error);
            return `${prefix}-1${dateSuffix}`;
        }

        let maxNumber = 0;
        if (data && data.length > 0) {
            data.forEach(record => {
                if (record.member_id) {
                    const parts = record.member_id.split('-');
                    if (parts.length === 3) {
                        const idPart = parts[2];
                        const numberStr = idPart.substring(0, idPart.length - 6);
                        const num = parseInt(numberStr);
                        if (!isNaN(num) && num > maxNumber) {
                            maxNumber = num;
                        }
                    }
                }
            });
        }

        const nextNumber = maxNumber + 1;
        return `${prefix}-${nextNumber}${dateSuffix}`;

    } catch (err) {
        console.error('Generate member ID error:', err);
        return `${prefix}-1${dateSuffix}`;
    }
}

// ============================================
// UPDATE MEMBER ID SAAT NAIK LEVEL
// ============================================

async function updateMemberIdOnLevelUp(userId, newLevelKey) {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    try {
        const { data: profile, error: profileError } = await supabase
            .from('yata_profiles')
            .select('member_id')
            .eq('id', userId)
            .single();

        if (profileError) throw profileError;

        let numberPart = '';
        let datePart = '';
        
        if (profile.member_id && profile.member_id !== 'undefined' && profile.member_id !== 'null') {
            const parts = profile.member_id.split('-');
            if (parts.length === 3) {
                const idPart = parts[2];
                datePart = idPart.slice(-6);
                numberPart = idPart.substring(0, idPart.length - 6);
            }
        }

        if (!numberPart || !datePart || numberPart === 'undefined') {
            const now = new Date();
            const tanggal = String(now.getDate()).padStart(2, '0');
            const bulan = String(now.getMonth() + 1).padStart(2, '0');
            const tahun = String(now.getFullYear()).slice(-2);
            datePart = `${tanggal}${bulan}${tahun}`;
            
            const { count } = await supabase
                .from('yata_profiles')
                .select('*', { count: 'exact', head: true });
            numberPart = String((count || 0) + 1);
        }

        const prefixMap = {
            'tamu': 'Yatta-T',
            'penulis': 'Yatta-P',
            'penulis_profesional': 'Yatta-PP',
            'mentor': 'Yatta-M'
        };
        
        const newPrefix = prefixMap[newLevelKey] || 'Yatta-P';
        const newMemberId = `${newPrefix}-${numberPart}${datePart}`;

        const { error: updateError } = await supabase
            .from('yata_profiles')
            .update({ 
                member_id: newMemberId,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId);

        if (updateError) throw updateError;

        console.log(`✅ Member ID updated: ${newMemberId}`);
        return newMemberId;

    } catch (err) {
        console.error('Update member ID error:', err);
        return false;
    }
}

// ============================================
// FORMAT MEMBER ID (UNTUK DISPLAY)
// ============================================

function formatMemberId(memberId) {
    if (!memberId || memberId === 'undefined' || memberId === 'null' || memberId === '') {
        const now = new Date();
        const tanggal = String(now.getDate()).padStart(2, '0');
        const bulan = String(now.getMonth() + 1).padStart(2, '0');
        const tahun = String(now.getFullYear()).slice(-2);
        return `Yatta-T-1${tanggal}${bulan}${tahun}`;
    }
    
    const parts = memberId.split('-');
    if (parts.length === 3) {
        const idPart = parts[2];
        if (idPart.length >= 6 && !isNaN(parseInt(idPart.slice(-6)))) {
            return memberId;
        }
    }
    
    const now = new Date();
    const tanggal = String(now.getDate()).padStart(2, '0');
    const bulan = String(now.getMonth() + 1).padStart(2, '0');
    const tahun = String(now.getFullYear()).slice(-2);
    const dateSuffix = `${tanggal}${bulan}${tahun}`;
    
    if (parts.length === 3) {
        const idPart = parts[2];
        const num = parseInt(idPart.replace(/\D/g, ''));
        if (!isNaN(num) && num > 0) {
            return `${parts[0]}-${parts[1]}-${num}${dateSuffix}`;
        }
        return `${parts[0]}-${parts[1]}-1${dateSuffix}`;
    }
    
    return `${memberId}-1${dateSuffix}`;
}

// ============================================
// FUNGSI KTA
// ============================================

function getKTAValidDate() {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 2);
    return date.toLocaleDateString('id-ID', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric' 
    });
}

// ============================================
// FUNGSI SHOW ERROR
// ============================================

function showError(message, title = 'Terjadi Kesalahan') {
    console.error(`❌ ${title}: ${message}`);
    
    let toast = document.getElementById('errorToast');
    if (toast) {
        const titleEl = document.getElementById('errorTitle');
        const msgEl = document.getElementById('errorMessage');
        if (titleEl) titleEl.textContent = title;
        if (msgEl) msgEl.textContent = message;
        toast.classList.remove('translate-x-full', 'opacity-0');
        toast.classList.add('translate-x-0', 'opacity-100');
        return;
    }
    
    alert(`${title}\n\n${message}`);
}

function handleSupabaseError(error, context = '') {
    console.error(`❌ Error${context ? ' di ' + context : ''}:`, error);

    const errorMessages = {
        '23505': 'Data sudah ada. Silakan gunakan data lain.',
        '23503': 'Data tidak ditemukan atau tidak valid.',
        '42P01': 'Tabel tidak ditemukan. Hubungi admin.',
        '42501': 'Anda tidak memiliki izin untuk melakukan ini.',
        'PGRST116': 'Data tidak ditemukan.',
        'auth/invalid-credentials': 'Email atau password salah.',
        'auth/email-not-confirmed': 'Email belum dikonfirmasi. Cek kotak masuk Anda.',
        'auth/user-not-found': 'Akun tidak ditemukan.',
        'auth/weak-password': 'Password terlalu lemah. Minimal 6 karakter.',
    };

    let userMessage = errorMessages[error.code] || error.message || 'Terjadi kesalahan. Silakan coba lagi.';
    showError(userMessage, '⚠️ ' + (context || 'Gagal'));
}

// ============================================
// FUNGSI TIME AGO
// ============================================

function timeAgo(date) {
    const now = new Date();
    const past = new Date(date);
    const diff = Math.floor((now - past) / 1000);

    if (diff < 60) return 'baru saja';
    if (diff < 3600) return Math.floor(diff / 60) + ' menit lalu';
    if (diff < 86400) return Math.floor(diff / 3600) + ' jam lalu';
    if (diff < 604800) return Math.floor(diff / 86400) + ' hari lalu';
    if (diff < 2592000) return Math.floor(diff / 604800) + ' minggu lalu';
    return past.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getLevelIcon(level) {
    const icons = {
        'Tamu': '🌱',
        'Penulis': '✍️',
        'Penulis Profesional': '📚',
        'Mentor': '🌟'
    };
    return icons[level] || '🌱';
}

// ============================================
// FUNGSI RATE LIMITING
// ============================================

const RATE_LIMITS = {
    comment: 30,
    testimonial: 60,
    contact: 60,
    notification: 60,
    message: 60,
    login: 5,
    register: 10,
    campaign: 60,
    like: 3,
    favorite: 3,
    create_mentoring: 60,
};

function checkRateLimit(action, customCooldown = null) {
    const cooldown = customCooldown || RATE_LIMITS[action] || 30;
    const key = `rate_limit_${action}`;
    const lastAttempt = localStorage.getItem(key);
    const now = Date.now();

    if (lastAttempt) {
        const elapsed = (now - parseInt(lastAttempt)) / 1000;
        if (elapsed < cooldown) {
            const waitTime = Math.ceil(cooldown - elapsed);
            return {
                allowed: false,
                waitTime: waitTime,
                message: `Mohon tunggu ${waitTime} detik sebelum mencoba lagi.`
            };
        }
    }

    return { allowed: true, waitTime: 0, message: '' };
}

function saveRateLimit(action) {
    const key = `rate_limit_${action}`;
    localStorage.setItem(key, Date.now().toString());
}

function resetRateLimit(action) {
    const key = `rate_limit_${action}`;
    localStorage.removeItem(key);
}

// ============================================
// FUNGSI GUEST
// ============================================

function getGuestId() {
    let guestId = localStorage.getItem('guest_id');
    if (!guestId) {
        guestId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
        localStorage.setItem('guest_id', guestId);
    }
    return guestId;
}

async function ensureGuestProfile(userId) {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) {
            console.warn('⚠️ Supabase client not available');
            return false;
        }
        
        const { data: existing, error } = await supabase
            .from('yata_profiles')
            .select('id')
            .eq('id', userId)
            .maybeSingle();
            
        if (!existing && userId.startsWith('guest_')) {
            await supabase
                .from('yata_profiles')
                .insert([{
                    id: userId,
                    full_name: 'Tamu',
                    username: 'tamu_' + Date.now(),
                    role: 'guest',
                    member_level: 'Tamu',
                }]);
        }
        return true;
    } catch (err) {
        console.error('Ensure guest profile error:', err);
        return false;
    }
}

// ============================================
// 🔥 FUNGSI FAVORIT
// ============================================

async function toggleFavorite(writingId, userId) {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) {
            console.error('❌ Supabase client not available');
            throw new Error('Supabase client not available');
        }
        
        const { data: existing, error: checkError } = await supabase
            .from('yata_favorites')
            .select('id')
            .eq('user_id', userId)
            .eq('writing_id', writingId)
            .maybeSingle();

        if (checkError) {
            console.error('❌ Check favorite error:', checkError);
            throw checkError;
        }

        if (existing) {
            const { error: deleteError } = await supabase
                .from('yata_favorites')
                .delete()
                .eq('id', existing.id);

            if (deleteError) {
                console.error('❌ Delete favorite error:', deleteError);
                throw deleteError;
            }
            return { action: 'removed', message: '✅ Dihapus dari favorit' };
        } else {
            const { error: insertError } = await supabase
                .from('yata_favorites')
                .insert([{ user_id: userId, writing_id: writingId }]);

            if (insertError) {
                console.error('❌ Insert favorite error:', insertError);
                throw insertError;
            }
            return { action: 'added', message: '✅ Ditambahkan ke favorit' };
        }

    } catch (err) {
        console.error('❌ Toggle favorite error:', err);
        throw err;
    }
}

async function getFavoriteIds(userId) {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) {
            console.warn('⚠️ Supabase client not available');
            return new Set();
        }
        
        const { data, error } = await supabase
            .from('yata_favorites')
            .select('writing_id')
            .eq('user_id', userId);

        if (error) {
            console.error('❌ Get favorites error:', error);
            return new Set();
        }
        
        return new Set(data.map(f => f.writing_id));
    } catch (err) {
        console.error('❌ Get favorites error:', err);
        return new Set();
    }
}

// ============================================
// FUNGSI SHARE
// ============================================

function openShareDialog(title, url, type = 'karya') {
    let dialog = document.getElementById('shareDialog');
    if (dialog) {
        dialog.remove();
    }

    dialog = document.createElement('div');
    dialog.id = 'shareDialog';
    dialog.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4';
    dialog.innerHTML = `
        <div class="bg-white rounded-3xl max-w-md w-full p-6 md:p-8 relative shadow-2xl modal-enter" onclick="event.stopPropagation()">
            <button onclick="closeShareDialog()" class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-2xl">
                <i class="fa-solid fa-xmark"></i>
            </button>
            <div class="text-center mb-6">
                <span class="text-emerald-600 text-sm font-bold uppercase tracking-wider">Bagikan</span>
                <h3 class="text-xl font-black text-slate-800 mt-1">${title}</h3>
                <p class="text-xs text-slate-500 mt-1">Bagikan ${type} ini ke media sosial</p>
            </div>
            <div class="grid grid-cols-4 gap-3 mb-4">
                <button onclick="shareToWhatsApp('${url}')" class="bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl transition flex flex-col items-center gap-1 text-xs">
                    <i class="fa-brands fa-whatsapp text-2xl"></i>
                    <span>WhatsApp</span>
                </button>
                <button onclick="shareToTwitter('${url}', '${title}')" class="bg-black hover:bg-gray-800 text-white font-bold py-3 rounded-xl transition flex flex-col items-center gap-1 text-xs">
                    <i class="fa-brands fa-x-twitter text-2xl"></i>
                    <span>Twitter/X</span>
                </button>
                <button onclick="shareToFacebook('${url}')" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition flex flex-col items-center gap-1 text-xs">
                    <i class="fa-brands fa-facebook text-2xl"></i>
                    <span>Facebook</span>
                </button>
                <button onclick="shareToTelegram('${url}', '${title}')" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-xl transition flex flex-col items-center gap-1 text-xs">
                    <i class="fa-brands fa-telegram text-2xl"></i>
                    <span>Telegram</span>
                </button>
            </div>
            <div class="border-t border-slate-200 pt-4">
                <div class="flex items-center gap-2 bg-slate-50 rounded-xl p-3">
                    <input type="text" id="shareLinkInput" value="${url}" readonly class="flex-1 bg-transparent text-sm text-slate-600 outline-none" />
                    <button onclick="copyLink('${url}')" class="text-emerald-600 hover:text-emerald-700 font-semibold text-sm whitespace-nowrap">
                        <i class="fa-regular fa-copy mr-1"></i> Copy
                    </button>
                </div>
                <p class="text-xs text-slate-400 mt-2 text-center">🔗 Link siap dibagikan</p>
            </div>
            <button onclick="closeShareDialog()" class="w-full mt-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition text-sm">Tutup</button>
        </div>
    `;

    document.body.appendChild(dialog);
    document.body.style.overflow = 'hidden';

    dialog.addEventListener('click', function(e) {
        if (e.target === this) closeShareDialog();
    });
}

function closeShareDialog() {
    const dialog = document.getElementById('shareDialog');
    if (dialog) {
        dialog.remove();
        document.body.style.overflow = 'auto';
    }
}

function copyLink(url) {
    navigator.clipboard.writeText(url).then(() => {
        showError('✅ Link berhasil disalin!', 'Sukses');
        setTimeout(closeShareDialog, 1000);
    }).catch(() => {
        const input = document.getElementById('shareLinkInput');
        if (input) {
            input.select();
            document.execCommand('copy');
            showError('✅ Link berhasil disalin!', 'Sukses');
            setTimeout(closeShareDialog, 1000);
        }
    });
}

function shareToWhatsApp(url) {
    const encodedUrl = encodeURIComponent(url);
    window.open(`https://wa.me/?text=${encodedUrl}`, '_blank');
}

function shareToTwitter(url, title) {
    const encodedText = encodeURIComponent(`${title}\n\n${url}`);
    window.open(`https://twitter.com/intent/tweet?text=${encodedText}`, '_blank');
}

function shareToFacebook(url) {
    const encodedUrl = encodeURIComponent(url);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, '_blank');
}

function shareToTelegram(url, title) {
    const encodedText = encodeURIComponent(`${title}\n\n${url}`);
    window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodedText}`, '_blank');
}

// ============================================
// FUNGSI SKELETON
// ============================================

function injectSkeletonStyles() {
    if (document.getElementById('skeleton-styles')) return;

    const style = document.createElement('style');
    style.id = 'skeleton-styles';
    style.textContent = `
        .skeleton-card, .skeleton-item, .skeleton-book, .skeleton-row {
            opacity: 0.7;
            pointer-events: none;
        }
        .skeleton-card .bg-slate-200,
        .skeleton-item .bg-slate-200,
        .skeleton-book .bg-slate-200,
        .skeleton-row .bg-slate-200 {
            background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
            background-size: 200% 100%;
            animation: shimmer 1.5s ease-in-out infinite;
        }
        @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
        }
    `;
    document.head.appendChild(style);
}

function showSkeletonGrid(containerId, count = 6, type = 'card') {
    const container = document.getElementById(containerId);
    if (!container) return;

    let skeletonHtml = '';
    
    if (type === 'card') {
        for (let i = 0; i < count; i++) {
            skeletonHtml += `
                <div class="skeleton-card bg-white rounded-2xl p-5 border border-emerald-100/60 shadow-sm">
                    <div class="flex items-start gap-4">
                        <div class="w-16 h-20 rounded-lg bg-slate-200 flex-shrink-0"></div>
                        <div class="flex-1 space-y-3">
                            <div class="h-4 bg-slate-200 rounded w-3/4"></div>
                            <div class="h-3 bg-slate-200 rounded w-1/2"></div>
                            <div class="h-3 bg-slate-200 rounded w-2/3"></div>
                        </div>
                    </div>
                </div>
            `;
        }
    } else if (type === 'list') {
        for (let i = 0; i < count; i++) {
            skeletonHtml += `
                <div class="skeleton-item bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                    <div class="flex items-start gap-4">
                        <div class="w-10 h-10 rounded-full bg-slate-200 flex-shrink-0"></div>
                        <div class="flex-1 space-y-2">
                            <div class="h-4 bg-slate-200 rounded w-1/3"></div>
                            <div class="h-3 bg-slate-200 rounded w-2/3"></div>
                            <div class="h-3 bg-slate-200 rounded w-1/2"></div>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    container.innerHTML = skeletonHtml;
}

function showSkeletonTable(containerId, rows = 5) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let skeletonHtml = '';
    for (let i = 0; i < rows; i++) {
        skeletonHtml += `
            <div class="skeleton-row flex items-center justify-between p-4 border-b border-slate-100">
                <div class="flex-1 space-y-2">
                    <div class="h-4 bg-slate-200 rounded w-1/2"></div>
                    <div class="h-3 bg-slate-200 rounded w-1/4"></div>
                </div>
                <div class="flex gap-2">
                    <div class="h-8 bg-slate-200 rounded w-16"></div>
                </div>
            </div>
        `;
    }
    container.innerHTML = skeletonHtml;
}

// ============================================
// FUNGSI MENTORING
// ============================================

function getMentoringStatusLabel(status) {
    const labels = {
        pending: '⏳ Menunggu Konfirmasi',
        approved: '✅ Diterima',
        rejected: '❌ Ditolak',
        completed: '✅ Selesai'
    };
    return labels[status] || '⏳ Menunggu';
}

function getMentoringSessionStatusLabel(status) {
    const labels = {
        draft: '📝 Draft',
        published: '✅ Published',
        ongoing: '🔄 Sedang Berlangsung',
        completed: '✅ Selesai',
        cancelled: '❌ Dibatalkan'
    };
    return labels[status] || '📝 Draft';
}

function getMentoringLevelLabel(level) {
    const labels = {
        pemula: '🌱 Pemula',
        menengah: '📈 Menengah',
        lanjutan: '🚀 Lanjutan'
    };
    return labels[level] || '🌱 Pemula';
}

function getMentoringCategoryIcon(category) {
    const icons = {
        'menulis-cerpen': '📝',
        'menulis-puisi': '📖',
        'menulis-novel': '📚',
        'teknik-menulis': '✍️',
        'editorial': '🔍',
        'umum': '📌'
    };
    return icons[category] || '📌';
}

function formatMentoringPrice(price) {
    if (price === 0) return '🆓 Gratis';
    return '💰 Rp' + (price || 0).toLocaleString('id-ID');
}

function canUserBeMentor(memberLevel) {
    const allowedLevels = ['Penulis', 'Penulis Profesional', 'Mentor'];
    return allowedLevels.includes(memberLevel);
}

function generateMentoringSlug(title) {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

function isValidMentoringSlug(slug) {
    return /^[a-z0-9-]+$/.test(slug) && slug.length >= 3;
}

// ============================================
// 🔥 KIRIM NOTIFIKASI
// ============================================

async function sendNotification(userId, title, content, type = 'info') {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) return false;

        const { data: notifData, error } = await supabase
            .from('yata_notifications')
            .insert([{
                title: title,
                content: content,
                type: type
            }])
            .select()
            .single();

        if (error) {
            console.error('❌ Insert notif error:', error);
            return false;
        }

        if (notifData && userId) {
            await supabase
                .from('yata_user_notifications')
                .insert([{
                    notification_id: notifData.id,
                    user_id: userId,
                    is_read: false
                }]);
        }
        return true;
    } catch (err) {
        console.error('❌ Send notification error:', err);
        return false;
    }
}

// ============================================
// INJECT SKELETON STYLES
// ============================================

if (typeof document !== 'undefined') {
    injectSkeletonStyles();
}

console.log('✅ utils.js loaded successfully');
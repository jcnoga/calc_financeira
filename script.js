// CONFIGURAÇÃO FIREBASE (Atualizado com Firestore)
const firebaseConfig = {
  apiKey: "AIzaSyDWwDLl34BLd1mYLSniJ8ucDTeaj4IX_2s",
  authDomain: "calc-financeira.firebaseapp.com",
  projectId: "calc-financeira",
  storageBucket: "calc-financeira.firebasestorage.app",
  messagingSenderId: "100771394956",
  appId: "1:100771394956:web:bc45a56637e96c829912a9",
  measurementId: "G-CM1DGS89CT"
};

// Inicializa Firebase (Se disponível)
let auth, googleProvider, db;
try {
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore(); // Inicializa Firestore
    googleProvider = new firebase.auth.GoogleAuthProvider();
} catch (e) {
    console.error("Erro ao inicializar Firebase", e);
}

document.addEventListener('DOMContentLoaded', () => {

    // --- CONSTANTES DE SEGURANÇA PARA CÁLCULO DA LICENÇA ---
    const LICENSE_CONSTANTS = {
        ADD_VALUE: 13,
        MULTIPLIER: 9,
        BASE_NUMBER: 1954
    };

    // --- NOVAS FUNCIONALIDADES ADICIONADAS ---
    
    // Sistema de Licença
    const licenseModal = document.getElementById('license-modal');
    const btnLicense = document.getElementById('btn-license');
    const btnGenerateCode = document.getElementById('btn-generate-code');
    const btnActivateLicense = document.getElementById('btn-activate-license');
    const licenseCodeInput = document.getElementById('license-code');
    const licenseInput = document.getElementById('license-input');
    const licenseInfo = document.getElementById('license-info');
    const licenseDetails = document.getElementById('license-details');
    const licenseExpiry = document.getElementById('license-expiry');
    const licenseStatus = document.getElementById('license-status');
    const btnCalculate = document.getElementById('btn-calculate');
    
    // Sistema de Doações
    const donationButtons = document.querySelectorAll('.btn-donation[data-amount]');
    const btnDonationOther = document.getElementById('btn-donation-other');
    const PIX_KEY = 'b4648948-d0a8-4402-81f4-8a4047fcf4e5';
    
    // Elementos para o sistema de recuperação
    const recoveryNotice = document.getElementById('recovery-notice');
    const recoveryMessage = document.getElementById('recovery-message');
    const closeRecoveryNotice = document.getElementById('close-recovery-notice');
    const autoSaveStatus = document.getElementById('auto-save-status');
    const saveStatusText = document.getElementById('save-status-text');
    
    // Configuração do autosalvamento
    const AUTO_SAVE_INTERVAL = 30000; // 30 segundos
    const AUTO_SAVE_KEY = 'pme_calculator_autosave';
    const LAST_SESSION_KEY = 'pme_calculator_last_session';
    let autoSaveTimer = null;
    let isSaving = false;
    
    // Funções do Sistema de Recuperação e Autosalvamento (Atualizado para Cloud + Local)
    function initializeAutoSave() {
        // Carrega dados salvos automaticamente (verifica nuvem e local)
        loadAutoSavedData();
        
        // Configura o salvamento automático periódico
        autoSaveTimer = setInterval(saveAutoData, AUTO_SAVE_INTERVAL);
        
        // Salva automaticamente quando o usuário sai da página
        window.addEventListener('beforeunload', saveAutoData);
        
        // Monitora alterações nos campos
        setupInputMonitoring();
        
        // Atualiza o status do autosalvamento
        updateAutoSaveStatus('saved');
    }
    
    function setupInputMonitoring() {
        const inputs = document.querySelectorAll('#financial-form input');
        inputs.forEach(input => {
            input.addEventListener('input', () => {
                updateAutoSaveStatus('saving');
                // Salva após 1 segundo de inatividade (debounce)
                clearTimeout(window.inputDebounceTimer);
                window.inputDebounceTimer = setTimeout(() => {
                    saveAutoData();
                }, 1000);
            });
        });
    }
    
    // Salva dados no Local Storage E na Nuvem
    function saveAutoData() {
        if (isSaving) return;
        
        isSaving = true;
        updateAutoSaveStatus('saving');
        
        try {
            const inputs = getFormInputs();
            const saveData = {
                data: inputs,
                timestamp: new Date().toISOString(),
                userId: getCurrentUserId()
            };
            
            // 1. Salvar Localmente (Mantido)
            localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(saveData));
            localStorage.setItem(LAST_SESSION_KEY, new Date().toISOString());
            
            // 2. Salvar na Nuvem (Novo)
            if (auth && auth.currentUser) {
                db.collection('users').doc(auth.currentUser.uid).set({
                    financialData: inputs,
                    lastModified: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true }).then(() => {
                    console.log("Dados sincronizados com a nuvem.");
                }).catch((error) => {
                    console.error("Erro ao salvar na nuvem:", error);
                });
            }

            setTimeout(() => {
                isSaving = false;
                updateAutoSaveStatus('saved');
            }, 500);
            
            return true;
        } catch (error) {
            console.error('Erro ao salvar automaticamente:', error);
            isSaving = false;
            updateAutoSaveStatus('error');
            return false;
        }
    }
    
    // Carrega dados. Prioriza Cloud no login inicial.
    function loadAutoSavedData() {
        try {
            // Se estiver logado, tenta pegar da nuvem primeiro
            if (auth && auth.currentUser) {
                db.collection('users').doc(auth.currentUser.uid).get().then((doc) => {
                    if (doc.exists) {
                        const userData = doc.data();
                        
                        // Sync de Licença (Nuvem -> Local)
                        if (userData.license) {
                            localStorage.setItem('pme_calculator_license', JSON.stringify(userData.license));
                            checkLicenseExpiry(); // Revalida visualmente
                        }

                        // Sync de Dados Financeiros
                        if (userData.financialData && Object.keys(userData.financialData).length > 0) {
                            restoreAutoSavedData(userData.financialData, false); // Restaura silenciosamente
                            console.log("Dados carregados da nuvem.");
                            return; // Se achou na nuvem, não precisa olhar local storage agora
                        }
                    }
                    // Fallback para local se nuvem estiver vazia
                    checkLocalData();
                }).catch((err) => {
                    console.error("Erro ao buscar dados na nuvem:", err);
                    checkLocalData();
                });
            } else {
                checkLocalData();
            }
        } catch (error) {
            console.error('Erro ao carregar dados salvos:', error);
        }
    }

    function checkLocalData() {
        const savedData = localStorage.getItem(AUTO_SAVE_KEY);
        const lastSession = localStorage.getItem(LAST_SESSION_KEY);
        
        if (savedData && lastSession) {
            const data = JSON.parse(savedData);
            const lastSessionDate = new Date(lastSession);
            const now = new Date();
            const hoursDiff = Math.abs(now - lastSessionDate) / 36e5; 
            
            if (hoursDiff < 24 && data.userId === getCurrentUserId()) {
                showRecoveryNotice(data.data);
            }
        }
    }
    
    function showRecoveryNotice(data) {
        recoveryMessage.textContent = 'Dados não salvos foram recuperados da sua última sessão. Clique aqui para restaurar.';
        recoveryNotice.classList.remove('hidden');
        
        recoveryNotice.addEventListener('click', (e) => {
            if (e.target !== closeRecoveryNotice) {
                restoreAutoSavedData(data, true);
                recoveryNotice.classList.add('hidden');
            }
        });
        
        closeRecoveryNotice.addEventListener('click', (e) => {
            e.stopPropagation();
            recoveryNotice.classList.add('hidden');
        });
    }
    
    function restoreAutoSavedData(data, confirmAction = true) {
        if (!confirmAction || confirm('Deseja restaurar os dados da sua última sessão?')) {
            for (const [key, value] of Object.entries(data)) {
                const input = document.getElementById(key);
                if (input) {
                    input.value = value;
                }
            }
            if (confirmAction) alert('Dados restaurados com sucesso!');
            // Atualiza UI de erro se houver
            validateForm();
        }
    }
    
    function updateAutoSaveStatus(status) {
        autoSaveStatus.className = 'auto-save-status';
        autoSaveStatus.classList.add(status);
        
        switch(status) {
            case 'saving':
                saveStatusText.textContent = 'Salvando na nuvem...';
                break;
            case 'saved':
                saveStatusText.textContent = 'Salvo e sincronizado';
                break;
            case 'error':
                saveStatusText.textContent = 'Erro ao salvar';
                break;
            default:
                saveStatusText.textContent = 'Autosalvamento ativo';
        }
    }
    
    function getCurrentUserId() {
        if (auth && auth.currentUser) return auth.currentUser.email;
        const loggedUser = sessionStorage.getItem('pme_logged_user');
        if (loggedUser) {
            const user = JSON.parse(loggedUser);
            return user.email;
        }
        return 'anonymous';
    }
    
    // Função para criar licença trial (Estrutura de dados)
    function getTrialLicenseData(days = 30) {
        const trialExpiryDate = new Date();
        trialExpiryDate.setDate(trialExpiryDate.getDate() + days);
        
        return {
            license: 'TRIAL-' + Math.random().toString(36).substr(2, 9),
            activationDate: new Date().toISOString(),
            expiryDate: trialExpiryDate.toISOString(),
            days: days,
            isTrial: true
        };
    }
    
    // Funções do Sistema de Licença
    function generateRandomCode() {
        return Math.floor(100 + Math.random() * 900); // Gera número entre 100 e 999
    }
    
    function calculatePassword(code, days) {
        const calculation = (code + LICENSE_CONSTANTS.ADD_VALUE) * LICENSE_CONSTANTS.MULTIPLIER + LICENSE_CONSTANTS.BASE_NUMBER;
        return `${calculation}-${days}`;
    }
    
    function validateLicenseFormat(licenseString) {
        const parts = licenseString.split('-');
        if (parts.length !== 2) return false;
        
        const [codePart, daysPart] = parts;
        const code = parseInt(codePart);
        const days = parseInt(daysPart);
        
        if (isNaN(code) || isNaN(days) || code <= 0 || days <= 0) return false;
        
        return { code, days };
    }
    
    function validateLicense(licenseString, generatedCode) {
        const validation = validateLicenseFormat(licenseString);
        if (!validation) return false;
        
        const { code, days } = validation;
        
        // Verifica se a licença corresponde ao código gerado
        const expectedLicense = calculatePassword(generatedCode, days);
        return licenseString === expectedLicense ? { code, days } : false;
    }
    
    function checkLicenseExpiry() {
        const licenseData = localStorage.getItem('pme_calculator_license');
        if (!licenseData) {
            licenseStatus.textContent = 'Licença: Não validada';
            btnCalculate.classList.add('btn-calculate-hidden');
            return false;
        }
        
        try {
            const { expiryDate, isTrial } = JSON.parse(licenseData);
            const now = new Date();
            const expiry = new Date(expiryDate);
            
            if (now > expiry) {
                licenseStatus.textContent = isTrial ? 'Licença: Trial Expirado' : 'Licença: Expirada';
                btnCalculate.classList.add('btn-calculate-hidden');
                showLicenseExpiredMessage();
                return false;
            } else {
                const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
                licenseStatus.textContent = isTrial ? 
                    `Licença: Trial (${daysLeft} dias restantes)` : 
                    `Licença: Válida (${daysLeft} dias restantes)`;
                btnCalculate.classList.remove('btn-calculate-hidden');
                return true;
            }
        } catch (e) {
            console.error('Erro ao verificar licença:', e);
            licenseStatus.textContent = 'Licença: Inválida';
            btnCalculate.classList.add('btn-calculate-hidden');
            return false;
        }
    }
    
    function showLicenseExpiredMessage() {
        // Mostra uma mensagem de alerta quando a licença expira
        // alert('Sua licença expirou! Por favor, renove sua licença para continuar usando o aplicativo.');
        // Comentado para não spammar alertas no load
        
        // Garante que o botão calcular está escondido
        btnCalculate.classList.add('btn-calculate-hidden');
    }
    
    // Inicializa verificação de licença
    checkLicenseExpiry();
    
    // Event Listeners para Sistema de Licença
    btnLicense.addEventListener('click', () => {
        licenseModal.classList.add('active');
        licenseInfo.classList.add('hidden');
        licenseInput.value = '';
    });
    
    btnGenerateCode.addEventListener('click', () => {
        const randomCode = generateRandomCode();
        licenseCodeInput.value = randomCode;
        
        // Informa o usuário sobre o formato
        alert(`Código gerado: ${randomCode}\n\nEnvie este código no formato: xxxxx-yyy\nOnde xxxxx é o código calculado e yyy é o número de dias de crédito a liberar.\n\nExemplo: Para 30 dias, você receberá um código como: 139405-30`);
    });
    
    btnActivateLicense.addEventListener('click', () => {
        const licenseString = licenseInput.value.trim();
        const generatedCode = parseInt(licenseCodeInput.value);
        
        if (!licenseString) {
            alert('Por favor, insira o código de licença.');
            return;
        }
        
        if (!generatedCode || isNaN(generatedCode)) {
            alert('Por favor, gere um código primeiro.');
            return;
        }
        
        // Valida o formato
        const formatValidation = validateLicenseFormat(licenseString);
        if (!formatValidation) {
            alert('Formato inválido! Use o formato: xxxxx-yyy\nOnde xxxxx é o código e yyy são os dias.\nExemplo: 139405-30');
            return;
        }
        
        // Valida a licença
        const validation = validateLicense(licenseString, generatedCode);
        
        if (!validation) {
            alert('Licença inválida! Verifique se o código está correto.\n\nLembre-se: Envie o código no formato xxxxx-yyy\nOnde xxxxx é o resultado do cálculo e yyy são os dias.');
            return;
        }
        
        const { days } = validation;
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + days);
        
        const licenseData = {
            license: licenseString,
            activationDate: new Date().toISOString(),
            expiryDate: expiryDate.toISOString(),
            days: days,
            isTrial: false
        };
        
        // Salva local
        localStorage.setItem('pme_calculator_license', JSON.stringify(licenseData));
        
        // Salva na Nuvem (Sync)
        if (auth && auth.currentUser) {
            db.collection('users').doc(auth.currentUser.uid).set({
                license: licenseData
            }, { merge: true });
        }
        
        // Mostra informações da licença
        licenseInfo.classList.remove('hidden');
        licenseDetails.textContent = `Licença ativada com sucesso para ${days} dias.`;
        licenseExpiry.textContent = `Expira em: ${expiryDate.toLocaleDateString()}`;
        
        // Atualiza status no rodapé
        checkLicenseExpiry();
        
        alert(`Licença ativada com sucesso! Seu acesso está liberado por ${days} dias.`);
    });
    
    // Fechar modal de licença
    document.querySelector('[data-modal="license"]').addEventListener('click', () => {
        licenseModal.classList.remove('active');
    });
    
    licenseModal.addEventListener('click', (e) => {
        if (e.target === licenseModal) {
            licenseModal.classList.remove('active');
        }
    });
    
    // Sistema de Doações
    donationButtons.forEach(button => {
        button.addEventListener('click', () => {
            const amount = button.getAttribute('data-amount');
            const message = `Para doar R$ ${amount}, use a seguinte chave PIX:\n\n${PIX_KEY}\n\nCopiado para a área de transferência!`;
            
            // Copia a chave PIX para a área de transferência
            navigator.clipboard.writeText(PIX_KEY).then(() => {
                alert(message);
            }).catch(err => {
                alert(`Para doar R$ ${amount}, use a seguinte chave PIX:\n\n${PIX_KEY}`);
            });
        });
    });
    
    btnDonationOther.addEventListener('click', () => {
        const customAmount = prompt('Digite o valor da doação (ex: 25.00):', '25.00');
        if (customAmount && !isNaN(parseFloat(customAmount))) {
            const message = `Para doar R$ ${customAmount}, use a seguinte chave PIX:\n\n${PIX_KEY}\n\nCopiado para a área de transferência!`;
            
            navigator.clipboard.writeText(PIX_KEY).then(() => {
                alert(message);
            }).catch(err => {
                alert(`Para doar R$ ${customAmount}, use a seguinte chave PIX:\n\n${PIX_KEY}`);
            });
        }
    });
    
    // --- FIM DAS NOVAS FUNCIONALIDADES ---

    // --- Gerenciamento de Autenticação ---
    const authSection = document.getElementById('auth-section');
    const mainApp = document.getElementById('main-application');
    const userArea = document.getElementById('user-area');
    const userWelcome = document.getElementById('user-welcome');
    const btnLogout = document.getElementById('btn-logout');

    // Elementos das Views de Auth
    const viewLogin = document.getElementById('login-view');
    const viewRegister = document.getElementById('register-view');
    const viewForgot = document.getElementById('forgot-view');

    // Links de Navegação Auth
    document.getElementById('link-to-register').addEventListener('click', () => switchAuthView(viewRegister));
    document.getElementById('link-to-forgot').addEventListener('click', () => switchAuthView(viewForgot));
    document.getElementById('link-to-login').addEventListener('click', () => switchAuthView(viewLogin));
    document.getElementById('link-back-login').addEventListener('click', () => switchAuthView(viewLogin));

    // Botões de Ação Auth
    document.getElementById('btn-do-login').addEventListener('click', handleLogin);
    document.getElementById('btn-do-register').addEventListener('click', handleRegister);
    document.getElementById('btn-do-forgot').addEventListener('click', handleForgotPass);
    // Botão Google
    document.getElementById('btn-google-login').addEventListener('click', handleGoogleLogin);
    
    btnLogout.addEventListener('click', handleLogout);

    // Verificar sessão existente (Local)
    // checkSession(); // Removido para usar a lógica do Firebase como prioritária

    // Listener de estado do Firebase (Nova funcionalidade de robustez)
    if (auth) {
        auth.onAuthStateChanged(function(user) {
            if (user) {
                // Se usuário logado no Firebase, mostra o app
                const appUser = {
                    name: user.displayName || user.email.split('@')[0],
                    email: user.email,
                    pass: 'firebase-auth'
                };
                
                // Garante que o sessionStorage esteja alinhado para a UI antiga funcionar
                sessionStorage.setItem('pme_logged_user', JSON.stringify(appUser));
                
                showApp(appUser);
            } else {
                // Se não houver usuário Firebase, mantem na tela de login
                sessionStorage.removeItem('pme_logged_user');
                showAuth();
            }
        });
    }

    function switchAuthView(viewToShow) {
        viewLogin.classList.add('hidden');
        viewRegister.classList.add('hidden');
        viewForgot.classList.add('hidden');
        viewToShow.classList.remove('hidden');
    }

    function showApp(user) {
        authSection.classList.add('hidden');
        mainApp.classList.remove('hidden');
        userArea.classList.remove('hidden');
        userWelcome.textContent = `Olá, ${user.name}`;
        
        // Carrega dados da nuvem e sincroniza
        initializeAutoSave();
        
        // Verifica a licença ao mostrar o app
        // checkLicenseExpiry é chamado dentro de loadAutoSavedData agora, após o sync
        
        // Limpa dados de autosalvamento de outros usuários
        cleanupOldAutoSaveData(user.email);
    }

    function showAuth() {
        authSection.classList.remove('hidden');
        mainApp.classList.add('hidden');
        userArea.classList.add('hidden');
        switchAuthView(viewLogin);
    }
    
    // Função legada mantida para não quebrar compatibilidade, mas não usada para auth principal
    function getUsersDb() {
        const users = localStorage.getItem('pme_calculator_users');
        return users ? JSON.parse(users) : [];
    }
    // Função legada mantida
    function saveUserDb(users) {
        localStorage.setItem('pme_calculator_users', JSON.stringify(users));
    }
    
    function cleanupOldAutoSaveData(currentUserEmail) {
        try {
            const savedData = localStorage.getItem(AUTO_SAVE_KEY);
            if (savedData) {
                const data = JSON.parse(savedData);
                if (data.userId && data.userId !== currentUserEmail) {
                    localStorage.removeItem(AUTO_SAVE_KEY);
                    localStorage.removeItem(LAST_SESSION_KEY);
                }
            }
        } catch (error) {
            console.error('Erro ao limpar dados antigos:', error);
        }
    }

    // ATUALIZADO: Registro via Firebase + Criação de DB Cloud com Licença
    function handleRegister() {
        const name = document.getElementById('reg-name').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const pass = document.getElementById('reg-pass').value.trim();

        if (!name || !email || !pass) {
            alert("Por favor, preencha todos os campos.");
            return;
        }

        if (!auth) {
            alert("Erro: Firebase não configurado.");
            return;
        }

        // Cria usuário na nuvem
        auth.createUserWithEmailAndPassword(email, pass)
            .then((userCredential) => {
                const user = userCredential.user;
                
                // Atualiza perfil (nome)
                user.updateProfile({
                    displayName: name
                });

                // Cria Licença Trial de 30 dias
                const trialData = getTrialLicenseData(30);
                
                // Salva dados iniciais no Firestore
                db.collection('users').doc(user.uid).set({
                    license: trialData,
                    financialData: {}, // Começa vazio
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                }).then(() => {
                    // Salva licença localmente também para acesso imediato
                    localStorage.setItem('pme_calculator_license', JSON.stringify(trialData));
                    alert("Conta criada com sucesso! Você recebeu 30 dias de acesso trial.");
                    
                    // Limpar campos
                    document.getElementById('reg-name').value = '';
                    document.getElementById('reg-email').value = '';
                    document.getElementById('reg-pass').value = '';
                });
            })
            .catch((error) => {
                const errorCode = error.code;
                const errorMessage = error.message;
                if(errorCode === 'auth/email-already-in-use') {
                    alert("Este e-mail já está cadastrado.");
                } else {
                    alert("Erro ao criar conta: " + errorMessage);
                }
            });
    }

    // ATUALIZADO: Login via Firebase
    function handleLogin() {
        const email = document.getElementById('login-email').value.trim();
        const pass = document.getElementById('login-pass').value.trim();

        if (!email || !pass) {
            alert("Preencha e-mail e senha.");
            return;
        }

        if (!auth) {
            alert("Erro: Firebase não configurado.");
            return;
        }

        auth.signInWithEmailAndPassword(email, pass)
            .then((userCredential) => {
                // O listener onAuthStateChanged cuidará da UI
                console.log("Login realizado com sucesso.");
                // Limpar campos
                document.getElementById('login-email').value = '';
                document.getElementById('login-pass').value = '';
            })
            .catch((error) => {
                alert("E-mail ou senha incorretos.");
                console.error(error);
            });
    }

    function handleGoogleLogin() {
        if (!auth) {
            alert("Erro de configuração do Firebase.");
            return;
        }
        auth.signInWithPopup(googleProvider)
            .then((result) => {
                const user = result.user;
                // Verifica se o documento do usuário existe, se não, cria com trial
                const userDocRef = db.collection('users').doc(user.uid);
                
                userDocRef.get().then((docSnapshot) => {
                    if (!docSnapshot.exists) {
                        // Usuário novo via Google: Dá licença Trial
                        const trialData = getTrialLicenseData(30);
                        userDocRef.set({
                            license: trialData,
                            financialData: {},
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        }).then(() => {
                            localStorage.setItem('pme_calculator_license', JSON.stringify(trialData));
                            alert("Bem-vindo! Você recebeu 30 dias de acesso trial.");
                        });
                    }
                });
            }).catch((error) => {
                console.error(error);
                alert("Erro ao entrar com Google: " + error.message);
            });
    }

    function handleForgotPass() {
        const email = document.getElementById('forgot-email').value.trim();
        if (!email) {
            alert("Informe seu e-mail.");
            return;
        }
        
        if (auth) {
            auth.sendPasswordResetEmail(email)
                .then(() => {
                        alert(`E-mail de recuperação enviado para ${email}. Verifique sua caixa de entrada.`);
                        switchAuthView(viewLogin);
                })
                .catch((error) => {
                    alert(`Erro ao enviar email: ${error.message}`);
                });
        }
    }

    function handleLogout() {
        // Salva dados antes de sair (Nuvem e Local)
        saveAutoData();
        
        sessionStorage.removeItem('pme_logged_user');
        if (auth) {
            auth.signOut().then(() => {
                showAuth();
            });
        } else {
            showAuth();
        }
        
        // Limpa o timer de autosalvamento
        if (autoSaveTimer) {
            clearInterval(autoSaveTimer);
        }
    }


    // --- Seletores do DOM da Aplicação ---
    const tabButtons = document.querySelectorAll('.app-nav button');
    const tabSections = document.querySelectorAll('.app-section');
    const form = document.getElementById('financial-form');
    const resultsWrapper = document.getElementById('results-wrapper');
    
    // Modal Elements
    const modalContainer = document.getElementById('modal-container');
    const modalCloseBtn = document.getElementById('modal-close');
    const modalTitle = document.getElementById('modal-title');
    const modalMeaning = document.getElementById('modal-meaning');
    const modalFormula = document.getElementById('modal-formula');
    const modalInterpretation = document.getElementById('modal-interpretation');
    const formulaSections = document.querySelectorAll('.section-formula');
    const interpretationSections = document.querySelectorAll('.section-interpretation');

    const recalculateBtn = document.getElementById('btn-recalculate');
    const exportCsvBtn = document.getElementById('btn-export-csv');
    const copyClipboardBtn = document.getElementById('btn-copy-clipboard');
    const helpButtons = document.querySelectorAll('.btn-help');
    
    // AI Analysis Elements
    const btnAiAnalysis = document.getElementById('btn-ai-analysis');
    const aiOptionsModal = document.getElementById('ai-options-modal');
    const btnAiCopy = document.getElementById('btn-ai-copy');
    const aiOptionsView = document.getElementById('ai-options-view');

    // Backup Elements
    const btnBackup = document.getElementById('btn-backup');
    const btnRestoreTrigger = document.getElementById('btn-restore-trigger');
    const fileRestoreInput = document.getElementById('file-restore');
    const btnDemoData = document.getElementById('btn-demo-data'); // Botão Demo

    let calculatedResults = []; 
    
    // --- Definições dos Ícones e Indicadores ---
    const icons = {
        vendas: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>`,
        custos: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>`,
        lucratividade: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
        equilibrio: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
        retorno: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>`,
        atividade: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>`,
        liquidez: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.2 16.2A10 10 0 1 1 8 2.8c.1-.4.2-.8.4-1.1"></path><path d="M10 2.3c.2-.3.4-.7.7-1"></path><path d="M12 21a10 10 0 0 1-10-10c0-.5.1-1 .2-1.5"></path><path d="M7 19.8c.1.1.2.2.3.3"></path><path d="M2.8 16.2a10 10 0 0 1-.2-1.5"></path><path d="M2.3 14c-.1.3-.2.7-.2 1"></path><path d="M19.8 17c.1-.1.2-.2.3-.3"></path><path d="M14 2.3c.3.1.7.2 1 .2"></path><path d="M17 2.8c.1-.1.2-.2.3-.3"></path><path d="M16.2 2.8a10 10 0 0 1 1.5.2"></path><path d="M19 7c.1.1.2.2.3.3"></path><path d="M21.7 10a10 10 0 0 1 .2 1.5"></path><path d="M21.7 14c.1-.3.2-.7.2-1"></path><path d="M17.7 19.7c-.1.1-.2.2-.3.3"></path><path d="M11 16.8c-.1.4-.2.8-.4 1.1"></path><path d="M14 21.7c-.3.1-.7.2-1 .2"></path><path d="M8 21.7c-.1-.1-.2-.2-.3-.3"></path><path d="M4.2 17.7c.1-.1.2-.2.3-.3"></path><path d="M4.2 6.3c-.1.1-.2.2-.3.3"></path><path d="M6.3 4.2a10 10 0 0 1 1.5-.2"></path><path d="M8 2.3c-.1.1-.2.2-.3.3"></path><path d="M3.3 8a10 10 0 0 1-.2-1.5"></path><path d="M3.3 12c-.1.3-.2.7-.2 1"></path></details></svg>`,
        endividamento: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"></line><line x1="4" y1="15" x2="20" y2="15"></line><line x1="10" y1="3" x2="8" y2="21"></line><line x1="16" y1="3" x2="14" y2="21"></line></svg>`,
    };
    
    const indicatorDefinitions = [
        // Vendas
        {
            id: 'faturamentoBruto',
            name: 'Faturamento Bruto',
            category: 'Vendas e Receita',
            icon: icons.vendas,
            calculate: (i) => i.faturamentoBruto,
            format: (v) => `R$ ${v.toFixed(2)}`,
            description: 'Total de vendas de produtos ou serviços antes de deduções.',
            formula: 'Input Direto',
            meaning: 'Este é o volume total de receita gerado pela sua operação principal em um período.',
            interpretation: (v) => `Seu faturamento de R$ ${v.toFixed(2)} é a linha de partida para todas as análises. O objetivo é sempre aumentá-lo ou torná-lo mais eficiente.`
        },
        {
            id: 'ticketMedio',
            name: 'Ticket Médio',
            category: 'Vendas e Receita',
            icon: icons.vendas,
            calculate: (i) => i.faturamentoBruto / i.numeroVendas,
            format: (v) => `R$ ${v.toFixed(2)}`,
            description: 'Valor médio de cada venda realizada.',
            formula: 'Faturamento Bruto / Nº de Vendas',
            meaning: 'Indica quanto, em média, cada cliente gasta por compra.',
            interpretation: (v) => `Um ticket médio de R$ ${v.toFixed(2)} sugere o perfil de compra do seu cliente. Para aumentar, considere estratégias de upsell (vender um produto melhor) ou cross-sell (vender produtos complementares).`
        },
        
        // Custos
        {
            id: 'custosVariaveis',
            name: 'Custos Variáveis (Totais)',
            category: 'Custos e Despesas',
            icon: icons.custos,
            calculate: (i) => i.custosVariaveis,
            format: (v) => `R$ ${v.toFixed(2)}`,
            description: 'Custos que mudam conforme o volume de produção ou vendas (CMV/CPV).',
            formula: 'Input Direto',
            meaning: 'Representa o custo direto para produzir ou adquirir o que você vendeu.',
            interpretation: (v) => `Seus custos variáveis de R$ ${v.toFixed(2)} são o primeiro grande "obstáculo" da sua receita. Negociar com fornecedores ou otimizar a produção pode reduzi-los.`
        },
        {
            id: 'custosFixos',
            name: 'Custos Fixos (Totais)',
            category: 'Custos e Despesas',
            icon: icons.custos,
            calculate: (i) => i.custosFixos,
            format: (v) => `R$ ${v.toFixed(2)}`,
            description: 'Custos que não mudam com o volume de vendas (aluguel, salários, etc).',
            formula: 'Input Direto',
            meaning: 'É o custo para manter a empresa funcionando, independentemente de vender ou não.',
            interpretation: (v) => `Com custos fixos de R$ ${v.toFixed(2)}, você precisa gerar receita suficiente para cobri-los todos os meses. Mantenha-os sob controle rigoroso.`
        },
        {
            id: 'custosTotais',
            name: 'Custos Totais',
            category: 'Custos e Despesas',
            icon: icons.custos,
            calculate: (i) => i.custosFixos + i.custosVariaveis,
            format: (v) => `R$ ${v.toFixed(2)}`,
            description: 'Soma de todos os custos, fixos e variáveis.',
            formula: 'Custos Fixos + Custos Variáveis',
            meaning: 'O valor total que sua empresa gastou no período para operar e vender.',
            interpretation: (v) => `Seu custo operacional total é de R$ ${v.toFixed(2)}. A eficiência da sua gestão é medida pela capacidade de reduzir este número sem afetar a qualidade ou o faturamento.`
        },
        {
            id: 'custoPorVenda',
            name: 'Custo por Venda (CPV)',
            category: 'Custos e Despesas',
            icon: icons.custos,
            calculate: (i) => (i.custosFixos + i.custosVariaveis) / i.numeroVendas,
            format: (v) => `R$ ${v.toFixed(2)}`,
            description: 'Custo total médio para realizar cada venda.',
            formula: 'Custos Totais / Nº de Vendas',
            meaning: 'Mostra quanto custa, em média, cada transação realizada (não confundir com Custo por Aquisição - CAC).',
            interpretation: (v) => `Cada venda custa em média R$ ${v.toFixed(2)} para ser realizada. Compare este valor com seu Ticket Médio. Se o Custo por Venda for maior que o Ticket Médio, você tem um problema sério.`
        },

        // Lucratividade e Margens
        {
            id: 'margemContribuicaoVal',
            name: 'Margem de Contribuição (R$)',
            category: 'Lucratividade e Margens',
            icon: icons.lucratividade,
            calculate: (i) => i.faturamentoBruto - i.custosVariaveis,
            format: (v) => `R$ ${v.toFixed(2)}`,
            description: 'Valor que sobra do faturamento após pagar os custos variáveis.',
            formula: 'Faturamento Bruto - Custos Variáveis',
            meaning: 'É o "motor" da empresa. Esse valor é o que sobra para pagar os Custos Fixos e, depois, gerar Lucro.',
            interpretation: (v, i) => `Você gerou R$ ${v.toFixed(2)} de Margem de Contribuição. Este valor é suficiente para pagar seus Custos Fixos de R$ ${i.custosFixos.toFixed(2)}? Se sim, a diferença é seu Lucro Operacional.`
        },
        {
            id: 'margemContribuicaoPerc',
            name: 'Margem de Contribuição (%)',
            category: 'Lucratividade e Margens',
            icon: icons.lucratividade,
            calculate: (i) => ((i.faturamentoBruto - i.custosVariaveis) / i.faturamentoBruto) * 100,
            format: (v) => `${v.toFixed(2)}%`,
            description: 'Percentual do faturamento que vira margem de contribuição.',
            formula: '(Margem de Contribuição R$ / Faturamento Bruto) * 100',
            meaning: 'Indica a eficiência da sua venda. Quanto maior, melhor.',
            interpretation: (v) => `Sua margem é de ${v.toFixed(2)}%. Isso significa que a cada R$ 100 vendidos, sobram R$ ${v.toFixed(2)} para pagar custos fixos e gerar lucro. Tente aumentar essa margem.`
        },
        {
            id: 'lucroBruto',
            name: 'Lucro Bruto',
            category: 'Lucratividade e Margens',
            icon: icons.lucratividade,
            calculate: (i) => i.faturamentoBruto - i.custosVariaveis,
            format: (v) => `R$ ${v.toFixed(2)}`,
            description: 'Resultado da empresa após subtrair os custos diretos (variáveis).',
            formula: 'Faturamento Bruto - Custos Variáveis',
            meaning: 'Similar à Margem de Contribuição, mede a rentabilidade direta das suas vendas.',
            interpretation: (v) => `Seu Lucro Bruto de R$ ${v.toFixed(2)} mostra o quanto sua atividade principal de venda é rentável antes de considerar a estrutura administrativa (custos fixos).`
        },
        {
            id: 'margemBruta',
            name: 'Margem Bruta (%)',
            category: 'Lucratividade e Margens',
            icon: icons.lucratividade,
            calculate: (i) => ((i.faturamentoBruto - i.custosVariaveis) / i.faturamentoBruto) * 100,
            format: (v) => `${v.toFixed(2)}%`,
            description: 'Percentual do faturamento que sobra como Lucro Bruto.',
            formula: '(Lucro Bruto / Faturamento Bruto) * 100',
            meaning: 'Mede a rentabilidade dos seus produtos ou serviços.',
            interpretation: (v) => `Uma Margem Bruta de ${v.toFixed(2)}% é um indicador chave. Se estiver baixa, seus custos variáveis (CMV/CPV) estão muito altos ou seu preço de venda está muito baixo.`
        },
        {
            id: 'lucroOperacional',
            name: 'Lucro Operacional (EBIT)',
            category: 'Lucratividade e Margens',
            icon: icons.lucratividade,
            calculate: (i) => i.faturamentoBruto - i.custosVariaveis - i.custosFixos,
            format: (v) => `R$ ${v.toFixed(2)}`,
            description: 'Lucro antes de impostos e juros. O resultado da operação.',
            formula: 'Lucro Bruto - Custos Fixos',
            meaning: 'Este é o verdadeiro resultado da sua operação. Mostra se a empresa é lucrativa em sua atividade principal.',
            interpretation: (v) => v > 0 ? `Parabéns! Sua operação gerou R$ ${v.toFixed(2)} de lucro. Este valor mostra que sua empresa é saudável operacionalmente.` : `Atenção! Sua operação deu um prejuízo de R$ ${v.toFixed(2)}. Você precisa vender mais, aumentar sua margem ou cortar custos fixos urgentemente.`
        },
        {
            id: 'margemOperacional',
            name: 'Margem Operacional (%)',
            category: 'Lucratividade e Margens',
            icon: icons.lucratividade,
            calculate: (i) => ((i.faturamentoBruto - i.custosVariaveis - i.custosFixos - i.faturamentoBruto) / i.faturamentoBruto) * 100, // Correção na fórmula original para cálculo percentual
            calculate: (i) => ((i.faturamentoBruto - i.custosVariaveis - i.custosFixos) / i.faturamentoBruto) * 100,
            format: (v) => `${v.toFixed(2)}%`,
            description: 'Percentual do faturamento que vira Lucro Operacional.',
            formula: '(Lucro Operacional / Faturamento Bruto) * 100',
            meaning: 'Mede a eficiência operacional da empresa como um todo.',
            interpretation: (v) => `Sua Margem Operacional é de ${v.toFixed(2)}%. A cada R$ 100 vendidos, sobram R$ ${v.toFixed(2)} como lucro da operação. ${v > 0 ? 'Este é um bom sinal de eficiência.' : 'Este é um sinal de alerta. Sua estrutura de custos (fixos + variáveis) está muito pesada para seu faturamento.'}`
        },
        {
            id: 'lucroLiquido',
            name: 'Lucro Líquido',
            category: 'Lucratividade e Margens',
            icon: icons.lucratividade,
            calculate: (i) => i.faturamentoBruto - i.custosVariaveis - i.custosFixos - i.impostos,
            format: (v) => `R$ ${v.toFixed(2)}`,
            description: 'O valor final que "sobra" para o dono ou para reinvestimento.',
            formula: 'Lucro Operacional - Impostos e Juros',
            meaning: 'É o resultado final da empresa após pagar absolutamente tudo. É o que vai para o bolso.',
            interpretation: (v) => v > 0 ? `Excelente! O Lucro Líquido do período foi de R$ ${v.toFixed(2)}. Este é o valor que pode ser distribuído aos sócios ou reinvestido na empresa.` : `Cuidado! A empresa teve um prejuízo líquido de R$ ${v.toFixed(2)}. A operação não está se pagando e está consumindo caixa ou aumentando dívidas.`
        },
        {
            id: 'margemLiquida',
            name: 'Margem Líquida (Lucratividade)',
            category: 'Lucratividade e Margens',
            icon: icons.lucratividade,
            calculate: (i) => ((i.faturamentoBruto - i.custosVariaveis - i.custosFixos - i.impostos) / i.faturamentoBruto) * 100,
            format: (v) => `${v.toFixed(2)}%`,
            description: 'O percentual de faturamento que vira lucro líquido.',
            formula: '(Lucro Líquido / Faturamento Bruto) * 100',
            meaning: 'Este é o indicador final de lucratividade. Mostra o quão eficiente a empresa é em transformar vendas em lucro.',
            interpretation: (v) => `Sua Margem Líquida é ${v.toFixed(2)}%. A cada R$ 100 faturados, R$ ${v.toFixed(2)} viram lucro de fato. ${v > 5 ? 'Uma ótima margem!' : 'Uma margem apertada. Analise seus custos ou estratégia de preços.'}`
        },
        
        // Ponto de Equilíbrio e Eficiência
        {
            id: 'pontoEquilibrioValor',
            name: 'Ponto de Equilíbrio (Valor)',
            category: 'Eficiência e Equilíbrio',
            icon: icons.equilibrio,
            calculate: (i) => i.custosFixos / ((i.faturamentoBruto - i.custosVariaveis) / i.faturamentoBruto),
            format: (v) => `R$ ${v.toFixed(2)}`,
            description: 'Quanto você precisa faturar para cobrir todos os custos (lucro zero).',
            formula: 'Custos Fixos / (Margem de Contribuição %)',
            meaning: 'É o faturamento mínimo para a empresa "empatar" no mês, sem lucro nem prejuízo.',
            interpretation: (v, i) => `Você precisa faturar R$ ${v.toFixed(2)} por mês apenas para pagar as contas. ${i.faturamentoBruto > v ? 'Você está acima do ponto de equilíbrio, o que é ótimo!' : 'Atenção! Você está faturando abaixo do seu ponto de equilíbrio, operando no prejuízo.'}`
        },
        {
            id: 'pontoEquilibrioUnidades',
            name: 'Ponto de Equilíbrio (Unidades)',
            category: 'Eficiência e Equilíbrio',
            icon: icons.equilibrio,
            calculate: (i) => {
                const margemPorUnidade = (i.faturamentoBruto - i.custosVariaveis) / i.numeroVendas;
                return i.custosFixos / margemPorUnidade;
            },
            format: (v) => `${Math.ceil(v)} unidades`,
            description: 'Quantas vendas você precisa fazer para atingir o lucro zero.',
            formula: 'Custos Fixos / (Margem de Contribuição por Unidade)',
            meaning: 'Define a meta de vendas mínima para a empresa não ter prejuízo.',
            interpretation: (v, i) => `Você precisa fazer ${Math.ceil(v)} vendas no mês para empatar. ${i.numeroVendas > v ? 'Você está vendendo mais que o mínimo, gerando lucro.' : 'Você está vendendo menos que o necessário para cobrir os custos.'}`
        },
        {
            id: 'markup',
            name: 'Markup (Divisor)',
            category: 'Eficiência e Equilíbrio',
            icon: icons.equilibrio,
            calculate: (i) => i.faturamentoBruto / i.custosVariaveis,
            format: (v) => `${v.toFixed(2)}x`,
            description: 'Múltiplo do seu custo variável que forma seu preço de venda.',
            formula: 'Faturamento Bruto / Custos Variáveis',
            meaning: 'Indica quantas vezes o seu preço de venda é maior que o seu custo de aquisição/produção.',
            interpretation: (v) => `Seu markup médio é ${v.toFixed(2)}x. Isso significa que, em média, você vende seus produtos por ${v.toFixed(2)} vezes o custo variável deles. (Ex: Custo R$ 10, Venda R$ 25 = Markup 2.5x).`
        },

        // Retorno (ROI, ROA, ROE)
        {
            id: 'roi',
            name: 'ROI (Retorno sobre Investimento)',
            category: 'Retorno (Investimento e Ativos)',
            icon: icons.retorno,
            calculate: (i) => ((i.faturamentoBruto - i.custosVariaveis - i.custosFixos - i.impostos) * 12) / i.investimentoInicial * 100, // Lucro Anualizado
            format: (v) => `${v.toFixed(2)}% a.a.`,
            description: 'Percentual de retorno que o investimento inicial gerou (anualizado).',
            formula: '(Lucro Líquido Anual / Investimento Inicial) * 100',
            meaning: 'Mede a capacidade do negócio de gerar retorno sobre o dinheiro total investido para criá-lo.',
            interpretation: (v) => `Seu ROI anualizado é de ${v.toFixed(2)}%. ${v > 0 ? 'Isso é o quanto o dinheiro investido no negócio rendeu. Compare com outras aplicações (ex: Tesouro Selic) para ver se o risco está valendo a pena.' : 'Seu ROI está negativo, indicando que o investimento está gerando prejuízo.'}`
        },
        {
            id: 'roa',
            name: 'ROA (Retorno sobre Ativos)',
            category: 'Retorno (Investimento e Ativos)',
            icon: icons.retorno,
            calculate: (i) => ((i.faturamentoBruto - i.custosVariaveis - i.custosFixos - i.impostos) / i.ativosTotais) * 100,
            format: (v) => `${v.toFixed(2)}%`,
            description: 'Eficiência da empresa em gerar lucro a partir de seus ativos.',
            formula: '(Lucro Líquido / Ativos Totais) * 100',
            meaning: 'Mede o quão eficientemente a empresa usa o que possui (máquinas, caixa, estoque) para gerar lucro.',
            interpretation: (v) => `Seu ROA é ${v.toFixed(2)}%. A cada R$ 100 em ativos, sua empresa gera R$ ${v.toFixed(2)} de lucro líquido. ${v > 0 ? 'Quanto maior, mais eficiente é sua gestão de ativos.' : 'Sua empresa não está conseguindo rentabilizar seus ativos.'}`
        },
        {
            id: 'roe',
            name: 'ROE (Retorno sobre Patr. Líquido)',
            category: 'Retorno (Investimento e Ativos)',
            icon: icons.retorno,
            calculate: (i) => ((i.faturamentoBruto - i.custosVariaveis - i.custosFixos - i.impostos) / i.patrimonioLiquido) * 100,
            format: (v) => `${v.toFixed(2)}%`,
            description: 'Retorno gerado sobre o capital próprio (dos sócios).',
            formula: '(Lucro Líquido / Patrimônio Líquido) * 100',
            meaning: 'Este é o indicador que mais importa para o sócio/investidor. Mede o quanto o capital próprio está rendendo.',
            interpretation: (v) => `O retorno sobre o capital dos sócios é de ${v.toFixed(2)}%. ${v > 15 ? 'Este é um retorno excelente sobre o capital investido.' : (v > 0 ? 'Este é um retorno positivo.' : 'O capital dos sócios está sendo destruído com o prejuízo.')}`
        },
        
        // Atividade
        {
            id: 'giroAtivo',
            name: 'Giro do Ativo',
            category: 'Atividade e Giro',
            icon: icons.atividade,
            calculate: (i) => i.faturamentoBruto / i.ativosTotais,
            format: (v) => `${v.toFixed(2)}`,
            description: 'Quantas vezes os ativos "giraram" para gerar receita.',
            formula: 'Faturamento Bruto / Ativos Totais',
            meaning: 'Mede a eficiência com que a empresa usa seus ativos para gerar vendas. (Não é lucro, é vendas).',
            interpretation: (v) => `Seu ativo girou ${v.toFixed(2)} vezes. Isso significa que para cada R$ 1,00 em ativos, você gerou R$ ${v.toFixed(2)} em vendas. ${v > 1 ? 'Isso indica boa eficiência, especialmente no varejo.' : 'Isso indica baixa eficiência ou que a empresa é muito capital-intensiva (indústria pesada).'}`
        },
        
        // Liquidez e Endividamento
        {
            id: 'liquidezCorrente',
            name: 'Índice de Liquidez Corrente',
            category: 'Liquidez e Endividamento',
            icon: icons.liquidez,
            calculate: (i) => i.ativosCirculantes / i.passivosCirculantes,
            format: (v) => `${v.toFixed(2)}`,
            description: 'Capacidade de pagar dívidas de curto prazo.',
            formula: 'Ativos Circulantes / Passivos Circulantes',
            meaning: 'Mostra quanto a empresa tem a receber no curto prazo (caixa, estoque, clientes) para cada R$ 1,00 que deve pagar no curto prazo (fornecedores, impostos).',
            interpretation: (v) => `Seu índice é ${v.toFixed(2)}. ${v > 1.5 ? `Ótimo. Você tem R$ ${v.toFixed(2)} para cada R$ 1,00 de dívida de curto prazo, indicando folga.` : (v > 1 ? `Positivo. Você tem R$ ${v.toFixed(2)} para cada R$ 1,00 de dívida, mas sem muita folga.` : `Alerta! Você tem menos de R$ 1,00 para pagar cada R$ 1,00 de dívida de curto prazo. Risco de caixa.`)}`
        },
        {
            id: 'endividamentoGeral',
            name: 'Endividamento Geral',
            category: 'Liquidez e Endividamento',
            icon: icons.endividamento,
            calculate: (i) => ((i.ativosTotais - i.patrimonioLiquido) / i.ativosTotais) * 100, // Passivo Total = Ativo Total - PL
            format: (v) => `${v.toFixed(2)}%`,
            description: 'Percentual dos ativos financiado por capital de terceiros.',
            formula: '(Passivos Totais / Ativos Totais) * 100',
            meaning: 'Mostra o quão "alavancada" a empresa está. Quanto do que ela possui, ela deve a terceiros?',
            interpretation: (v) => `Sua empresa é ${v.toFixed(2)}% financiada por dívidas. ${v > 50 ? 'Cuidado. Mais da metade dos seus ativos é financiada por terceiros. Isso aumenta o risco.' : 'Nível de endividamento controlado. Menos da metade dos seus ativos é financiada por terceiros.'}`
        },
        {
            id: 'grauEndividamento',
            name: 'Grau de Endividamento (Dívida/PL)',
            category: 'Liquidez e Endividamento',
            icon: icons.endividamento,
            calculate: (i) => (i.ativosTotais - i.patrimonioLiquido) / i.patrimonioLiquido,
            format: (v) => `${v.toFixed(2)}`,
            description: 'Quanto a empresa deve para cada R$ 1,00 de capital próprio.',
            formula: 'Passivos Totais / Patrimônio Líquido',
            meaning: 'Mede a proporção entre capital de terceiros (dívida) e capital próprio (sócios).',
            interpretation: (v) => `Para cada R$ 1,00 dos sócios, a empresa deve R$ ${v.toFixed(2)} a terceiros. ${v > 1 ? 'Risco alto. A empresa deve mais a terceiros do que aos próprios donos.' : 'Risco controlado. A empresa tem mais capital próprio do que dívidas.'}`
        },
        {
            id: 'impostosPerc',
            name: 'Carga Tributária Efetiva (%)',
            category: 'Lucratividade e Margens',
            icon: icons.custos,
            calculate: (i) => (i.impostos / (i.faturamentoBruto - i.custosVariaveis - i.custosFixos)) * 100,
            format: (v) => `${v.toFixed(2)}%`,
            description: 'Percentual do lucro operacional consumido por impostos e juros.',
            formula: '(Impostos e Juros / Lucro Operacional) * 100',
            meaning: 'Mede o impacto real dos impostos sobre o resultado da sua operação.',
            interpretation: (v) => `Dos lucros operacionais gerados, ${v.toFixed(2)}% foram usados para pagar impostos e juros. É fundamental revisar seu regime tributário (Simples, Presumido, Real) para otimizar essa carga.`
        },
    ];

    // --- Funções de Navegação ---
    function switchTab(tabId) {
        tabSections.forEach(section => {
            section.classList.remove('active');
            if (section.id === tabId) {
                section.classList.add('active');
            }
        });

        tabButtons.forEach(button => {
            button.classList.remove('active');
            if (button.dataset.tab === tabId) {
                button.classList.add('active');
            }
        });
    }

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            switchTab(button.dataset.tab);
        });
    });

    recalculateBtn.addEventListener('click', () => {
        switchTab('input-section');
    });

    // --- Funções de Validação ---
    function validateForm() {
        let isValid = true;
        const inputs = form.querySelectorAll('input[required]');
        
        inputs.forEach(input => {
            const errorEl = input.nextElementSibling;
            if (input.value.trim() === '' || parseFloat(input.value) < 0) {
                isValid = false;
                input.style.borderColor = 'var(--cor-perigo)';
                if (errorEl && errorEl.classList.contains('form-error')) {
                    errorEl.style.display = 'block';
                }
            } else {
                input.style.borderColor = '#ccc';
                if (errorEl && errorEl.classList.contains('form-error')) {
                    errorEl.style.display = 'none';
                }
            }
        });
        return isValid;
    }

    // --- Funções de Backup e Restore ---
    function backupData() {
        if (!validateForm()) {
            if (!confirm("Alguns campos estão vazios ou inválidos. Deseja fazer o backup mesmo assim?")) {
                return;
            }
        }
        
        const inputs = getFormInputs();
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(inputs, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "backup_financeiro.json");
        document.body.appendChild(downloadAnchorNode); // Necessário para Firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    function triggerRestore() {
        fileRestoreInput.value = null; // Reseta para permitir carregar o mesmo arquivo duas vezes
        fileRestoreInput.click();
    }

    fileRestoreInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                // Popula os campos
                for (const [key, value] of Object.entries(data)) {
                    const input = document.getElementById(key);
                    if (input) {
                        input.value = value;
                    }
                }
                
                alert("Dados restaurados com sucesso! Clique em 'Calcular' para ver os resultados.");
                validateForm(); // Remove erros visuais se houver
                
            } catch (err) {
                console.error(err);
                alert("Erro ao ler o arquivo de backup. Certifique-se de que é um arquivo JSON válido.");
            }
        };
        reader.readAsText(file);
    });

    // Event Listeners para Backup
    btnBackup.addEventListener('click', backupData);
    btnRestoreTrigger.addEventListener('click', triggerRestore);

    // --- Função Demo Data (Exemplo 80k) ---
    btnDemoData.addEventListener('click', () => {
        if(confirm('Deseja preencher o formulário com dados de exemplo (Faturamento ~R$ 80k)? Isso substituirá os dados atuais.')) {
            document.getElementById('faturamentoBruto').value = 80000;
            document.getElementById('custosVariaveis').value = 36000; // ~45%
            document.getElementById('custosFixos').value = 22000;     // ~27%
            document.getElementById('numeroVendas').value = 650;      // Ticket ~123
            document.getElementById('impostos').value = 5500;         // ~7% sobre a operação
            
            document.getElementById('ativosTotais').value = 120000;
            document.getElementById('patrimonioLiquido').value = 70000;
            document.getElementById('ativosCirculantes').value = 45000;
            document.getElementById('passivosCirculantes').value = 25000;
            
            document.getElementById('investimentoInicial').value = 90000;
            
            // Remove alertas visuais de erro se houver
            validateForm();
        }
    });


    // --- Funções de Cálculo e Exibição ---
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Verifica se a licença está válida
        if (!checkLicenseExpiry()) {
            alert('Sua licença expirou! Por favor, renove sua licença para continuar usando o aplicativo.');
            document.getElementById('btn-license').click(); // Abre o modal de licença
            return;
        }
        
        if (validateForm()) {
            const inputs = getFormInputs();
            calculatedResults = calculateAllIndicators(inputs);
            displayResults(calculatedResults);
            switchTab('results-section');
            
            // Salva os dados após o cálculo
            saveAutoData();
        } else {
            alert('Por favor, preencha todos os campos obrigatórios com valores válidos (positivos).');
        }
    });

    function getFormInputs() {
        const fields = ['faturamentoBruto', 'custosVariaveis', 'custosFixos', 'numeroVendas', 'impostos', 'ativosTotais', 'patrimonioLiquido', 'ativosCirculantes', 'passivosCirculantes', 'investimentoInicial'];
        const inputs = {};
        fields.forEach(id => {
            const val = parseFloat(document.getElementById(id).value);
            inputs[id] = isNaN(val) ? 0 : val;
        });
        return inputs;
    }

    function calculateAllIndicators(inputs) {
        const results = [];
        const safeInputs = { ...inputs };
        
        // Garante que não haja divisão por zero
        if (safeInputs.numeroVendas === 0) safeInputs.numeroVendas = 1;
        if (safeInputs.faturamentoBruto === 0) safeInputs.faturamentoBruto = 1;
        if (safeInputs.ativosTotais === 0) safeInputs.ativosTotais = 1;
        if (safeInputs.patrimonioLiquido === 0) safeInputs.patrimonioLiquido = 1;
        if (safeInputs.passivosCirculantes === 0) safeInputs.passivosCirculantes = 1;
        if (safeInputs.investimentoInicial === 0) safeInputs.investimentoInicial = 1;

        indicatorDefinitions.forEach(def => {
            let rawValue;
            try {
                rawValue = def.calculate(inputs);
            } catch (error) {
                console.error(`Erro ao calcular ${def.name}: ${error}`);
                rawValue = 0; 
            }

            if (isNaN(rawValue) || !isFinite(rawValue)) {
                rawValue = 0;
            }
            
            const formattedValue = def.format(rawValue);
            const interpretation = def.interpretation(rawValue, inputs);
            const sentiment = getSentiment(def.id, rawValue);
            
            results.push({
                ...def,
                rawValue,
                formattedValue,
                interpretation,
                sentiment
            });
        });
        return results;
    }
    
    function getSentiment(id, value) {
        if ([
            'faturamentoBruto', 'ticketMedio', 'margemContribuicaoVal', 'margemContribuicaoPerc',
            'lucroBruto', 'margemBruta', 'lucroOperacional', 'margemOperacional',
            'lucroLiquido', 'margemLiquida', 'roi', 'roa', 'roe', 'giroAtivo'
        ].includes(id)) {
            return value > 0 ? 'positive' : 'negative';
        }
        if (id === 'liquidezCorrente') {
            return value > 1.2 ? 'positive' : (value > 0.8 ? 'neutral' : 'negative');
        }
        if ([
            'custosVariaveis', 'custosFixos', 'custosTotais', 'custoPorVenda',
            'endividamentoGeral', 'grauEndividamento', 'impostosPerc'
        ].includes(id)) {
            return value > 0 ? 'negative' : 'neutral'; // Custos são "negativos" por natureza
        }
        if (id === 'pontoEquilibrioValor' || id === 'pontoEquilibrioUnidades') {
            return 'neutral';
        }
        return 'neutral';
    }

    function displayResults(results) {
        resultsWrapper.innerHTML = '';
        
        // Agrupa por categoria
        const categories = results.reduce((acc, result) => {
            (acc[result.category] = acc[result.category] || []).push(result);
            return acc;
        }, {});

        const categoryOrder = [
            'Vendas e Receita',
            'Custos e Despesas',
            'Lucratividade e Margens',
            'Eficiência e Equilíbrio',
            'Retorno (Investimento e Ativos)',
            'Atividade e Giro',
            'Liquidez e Endividamento'
        ];
        
        for(const categoryName of categoryOrder) {
            const items = categories[categoryName];
            if (!items) continue;

            const categoryEl = document.createElement('div');
            categoryEl.className = 'results-category';
            categoryEl.innerHTML = `<h3>${categoryName}</h3>`;
            
            const gridEl = document.createElement('div');
            gridEl.className = 'results-grid';

            items.forEach(item => {
                const card = document.createElement('div');
                card.className = 'indicator-card';
                card.innerHTML = `
                    <div class="card-header">
                        <div class="card-icon">${item.icon}</div>
                        <h4>${item.name}</h4>
                    </div>
                    <div class="card-value ${item.sentiment}">${item.formattedValue}</div>
                    <div class="card-description">${item.description}</div>
                    <div class="card-action">
                        <button class="btn-details" data-id="${item.id}">Ver Análise</button>
                    </div>
                `;
                
                card.querySelector('.btn-details').addEventListener('click', () => {
                    openModal(item, true); // true = show all details
                });
                
                gridEl.appendChild(card);
            });
            
            categoryEl.appendChild(gridEl);
            resultsWrapper.appendChild(categoryEl);
        }
    }

    // --- Funções do Modal ---
    function openModal(data, showFullDetails = false) {
        modalTitle.textContent = data.name || data.dataset.title;
        modalMeaning.textContent = data.meaning || data.dataset.description;
        
        if (showFullDetails) {
            // Veio do Card de Resultado
            modalFormula.textContent = data.formula;
            modalInterpretation.textContent = data.interpretation;
            modalInterpretation.className = `interpretation ${data.sentiment} section-interpretation`;
            
            formulaSections.forEach(el => el.classList.remove('hidden'));
            interpretationSections.forEach(el => el.classList.remove('hidden'));
        } else {
            // Veio do botão de ajuda do Input
            formulaSections.forEach(el => el.classList.add('hidden'));
            interpretationSections.forEach(el => el.classList.add('hidden'));
        }

        modalContainer.classList.add('active');
    }

    function closeModal() {
        modalContainer.classList.remove('active');
    }

    modalCloseBtn.addEventListener('click', closeModal);
    modalContainer.addEventListener('click', (e) => {
        if (e.target === modalContainer) {
            closeModal();
        }
    });

    helpButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            openModal(btn, false); 
        });
    });

    // --- Funções de Exportação ---
    function exportToCSV() {
        if (calculatedResults.length === 0) {
            alert('Calcule os indicadores primeiro.');
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent("Indicador,Valor Formatado,Categoria,Descricao\r\n");

        calculatedResults.forEach(item => {
            const row = [
                `"${item.name}"`,
                `"${item.formattedValue.replace('R$ ', '')}"`, 
                `"${item.category}"`,
                `"${item.description.replace(/"/g, '""')}"` 
            ].join(",");
            csvContent += row + "\r\n";
        });
        
        // Correção para forçar download
        const link = document.createElement("a");
        link.setAttribute("href", csvContent);
        link.setAttribute("download", "diagnostico_financeiro.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function copyToClipboard() {
        if (calculatedResults.length === 0) {
            alert('Calcule os indicadores primeiro.');
            return;
        }
        
        let text = "Resumo do Diagnóstico Financeiro\r\n";
        text += "===================================\r\n\r\n";

        const categories = calculatedResults.reduce((acc, result) => {
            (acc[result.category] = acc[result.category] || []).push(result);
            return acc;
        }, {});

        for (const categoryName in categories) {
            text += `--- ${categoryName.toUpperCase()} ---\r\n`;
            categories[categoryName].forEach(item => {
                text += `${item.name}: ${item.formattedValue}\r\n`;
            });
            text += "\r\n";
        }
        
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.top = "-9999px";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        
        textArea.focus();
        textArea.select();
        
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                alert('Resumo copiado para a área de transferência!');
            } else {
                alert('Não foi possível copiar. Tente manualmente.');
            }
        } catch (err) {
            alert('Erro ao copiar. Tente manualmente.');
        }
        
        document.body.removeChild(textArea);
    }
    
    // --- NOVA FUNCIONALIDADE: OPÇÕES DE IA (APENAS COPIAR) ---
    function openAIOptions() {
        if (calculatedResults.length === 0) {
            alert('Calcule os indicadores primeiro para gerar o prompt.');
            return;
        }
        
        // Abre o modal de opções
        aiOptionsModal.classList.add('active');
    }
    
    function buildPromptText() {
        const inputs = getFormInputs();
        
        // Prompt estruturado
        let prompt = "Atue como um Consultor Financeiro Sênior (CFO) especializado em PMEs. ";
        prompt += "Abaixo estão os dados operacionais e os indicadores calculados de uma empresa. ";
        prompt += "Analise-os profundamente e forneça um diagnóstico.\n\n";
        
        prompt += "=== 1. DADOS DE ENTRADA (INPUTS) ===\n";
        prompt += `Faturamento Bruto: R$ ${inputs.faturamentoBruto}\n`;
        prompt += `Custos Variáveis: R$ ${inputs.custosVariaveis}\n`;
        prompt += `Custos Fixos: R$ ${inputs.custosFixos}\n`;
        prompt += `Número de Vendas: ${inputs.numeroVendas}\n`;
        prompt += `Impostos/Juros: R$ ${inputs.impostos}\n`;
        prompt += `Ativos Totais: R$ ${inputs.ativosTotais}\n`;
        // Passivos totais estimado com base no PL
        prompt += `Passivos Totais: R$ ${inputs.passivosCirculantes + (inputs.ativosTotais - inputs.patrimonioLiquido - inputs.passivosCirculantes)}\n`; 
        prompt += `Patrimônio Líquido: R$ ${inputs.patrimonioLiquido}\n`;
        prompt += `Investimento Inicial: R$ ${inputs.investimentoInicial}\n\n`;

        prompt += "=== 2. INDICADORES CALCULADOS ===\n";
        
        const categories = calculatedResults.reduce((acc, result) => {
            (acc[result.category] = acc[result.category] || []).push(result);
            return acc;
        }, {});

        for (const categoryName in categories) {
            prompt += `--- ${categoryName} ---\n`;
            categories[categoryName].forEach(item => {
                prompt += `${item.name}: ${item.formattedValue}\n`;
            });
        }
        
        prompt += "\n=== 3. O QUE EU PRECISO ===\n";
        prompt += "Baseado nos números acima, forneça:\n";
        prompt += "1. **Diagnóstico Geral**: Qual a saúde real da empresa hoje? (Excelente, Boa, Alerta ou Crítica?)\n";
        prompt += "2. **Análise de Lucratividade**: A precificação e margens estão corretas? Onde estou perdendo dinheiro?\n";
        prompt += "3. **Análise de Estrutura**: Meus custos fixos estão altos demais para o meu faturamento?\n";
        prompt += "4. **Plano de Ação Imediato**: Liste 3 ações práticas e numéricas para melhorar o Lucro Líquido nos próximos 30 dias.\n";
        
        return prompt;
    }
    
    // Função 1: Copiar Prompt
    function copyPromptToClipboard() {
        const prompt = buildPromptText();
        
        const textArea = document.createElement("textarea");
        textArea.value = prompt;
        textArea.style.position = "fixed";
        textArea.style.top = "-9999px";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                alert('Prompt copiado! Cole no seu assistente de IA preferido.');
                // Fecha o modal após copiar
                aiOptionsModal.classList.remove('active');
            } else {
                alert('Erro ao copiar.');
            }
        } catch (err) {
            console.error('Erro', err);
            alert('Erro ao copiar.');
        }
        document.body.removeChild(textArea);
    }
    
    // --- Função Removida: Gerar via API (Solicitação do usuário) ---

    exportCsvBtn.addEventListener('click', exportToCSV);
    copyClipboardBtn.addEventListener('click', copyToClipboard);
    
    // Event Listeners IA
    btnAiAnalysis.addEventListener('click', openAIOptions);
    
    // Fechar modal de IA
    document.querySelector('[data-modal="ai-options"]').addEventListener('click', () => {
        aiOptionsModal.classList.remove('active');
    });
    
    // Botão Copiar no Modal (Pelo Card ou Botão interno)
    btnAiCopy.addEventListener('click', () => {
        copyPromptToClipboard();
    });

});
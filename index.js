```javascript
// --- CONSTANTES DE SEGURANÇA ---
const CONST_ADD = 13;
const CONST_MULT = 9;
const CONST_BASE = 1954;

// CONFIGURAÇÃO FIREBASE
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
    db = firebase.firestore();
    googleProvider = new firebase.auth.GoogleAuthProvider();
} catch (e) {
    console.error("Erro ao inicializar Firebase", e);
}

document.addEventListener('DOMContentLoaded', () => {

    // --- NOVAS FUNCIONALIDADES ADICIONADAS ---
    
    // Sistema de Licença
    const licenseModal = document.getElementById('license-modal');
    const btnLicense = document.getElementById('btn-license');
    const btnGenerateCode = document.getElementById('btn-generate-code');
    const btnCalculatePassword = document.getElementById('btn-calculate-password');
    const btnActivateLicense = document.getElementById('btn-activate-license');
    const licenseCodeInput = document.getElementById('license-code');
    const licenseDaysInput = document.getElementById('license-days');
    const passwordResultInput = document.getElementById('password-result');
    const licenseInput = document.getElementById('license-input');
    const licenseCalculation = document.getElementById('license-calculation');
    const calculationDetails = document.getElementById('calculation-details');
    const licenseInfo = document.getElementById('license-info');
    const licenseDetails = document.getElementById('license-details');
    const licenseExpiry = document.getElementById('license-expiry');
    const licenseStatus = document.getElementById('license-status');
    
    // Sistema de Doações
    const donationButtons = document.querySelectorAll('.btn-donation[data-amount]');
    const btnDonationOther = document.getElementById('btn-donation-other');
    const PIX_KEY = 'b4648948-d0a8-4402-81f4-8a4047fcf4e5';
    
    // Funções do Sistema de Licença
    function generateRandomCode() {
        return Math.floor(100 + Math.random() * 900); // Gera número entre 100 e 999
    }
    
    function calculatePassword(code, days) {
        // Utilizando as constantes para maior segurança e consistência
        const calculation = (code + CONST_ADD) * CONST_MULT + CONST_BASE;
        return `${calculation}-${days}`;
    }
    
    function validateLicense(licenseString) {
        const parts = licenseString.split('-');
        if (parts.length !== 2) return false;
        
        const [calculationPart, daysPart] = parts;
        const calculation = parseInt(calculationPart);
        const days = parseInt(daysPart);
        
        if (isNaN(calculation) || isNaN(days)) return false;
        
        // Validação simplificada: Apenas verifica formato e extrai dias
        return { calculation, days };
    }
    
    function checkLicenseExpiry() {
        const licenseData = localStorage.getItem('pme_calculator_license');
        
        // --- NOVO USUÁRIO: TRIAL DE 30 DIAS ---
        if (!licenseData) {
            const now = new Date();
            const expiryDate = new Date();
            expiryDate.setDate(now.getDate() + 30); // 30 dias de trial
            
            const trialLicense = {
                license: 'TRIAL-MODE',
                activationDate: now.toISOString(),
                expiryDate: expiryDate.toISOString(),
                days: 30
            };
            
            localStorage.setItem('pme_calculator_license', JSON.stringify(trialLicense));
            licenseStatus.textContent = 'Licença: Trial (30 dias)';
            return true;
        }
        
        try {
            const { expiryDate } = JSON.parse(licenseData);
            const now = new Date();
            const expiry = new Date(expiryDate);
            
            if (now > expiry) {
                licenseStatus.textContent = 'Licença: Expirada';
                showLicenseExpiredMessage();
                return false;
            } else {
                const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
                licenseStatus.textContent = `Licença: Válida (${daysLeft} dias restantes)`;
                return true;
            }
        } catch (e) {
            console.error('Erro ao verificar licença:', e);
            licenseStatus.textContent = 'Licença: Inválida';
            return false;
        }
    }
    
    function showLicenseExpiredMessage() {
        // Mostra uma mensagem de alerta quando a licença expira
        const mainApp = document.getElementById('main-application');
        const calculateBtn = document.querySelector('#financial-form button[type="submit"]');
        
        // Apenas bloqueia se o app estiver visível (logado)
        if (mainApp && !mainApp.classList.contains('hidden')) {
            alert('Sua licença expirou! Por favor, renove sua licença para continuar usando o aplicativo.');
            calculateBtn.disabled = true;
            calculateBtn.textContent = 'Licença Expirada - Renove para Calcular';
            calculateBtn.style.opacity = '0.5';
        }
    }
    
    // Inicializa verificação de licença
    checkLicenseExpiry();
    
    // Event Listeners para Sistema de Licença
    btnLicense.addEventListener('click', () => {
        licenseModal.classList.add('active');
    });
    
    btnGenerateCode.addEventListener('click', () => {
        const randomCode = generateRandomCode();
        licenseCodeInput.value = randomCode;
        
        // O cálculo abaixo acontece em background (escondido) para fins administrativos
        const days = parseInt(licenseDaysInput.value) || 30;
        const password = calculatePassword(randomCode, days);
        passwordResultInput.value = password;
        
        // Detalhes do cálculo (escondido do usuário)
        calculationDetails.textContent = `(${randomCode} + ${CONST_ADD}) × ${CONST_MULT} + ${CONST_BASE} = ${password}`;
    });
    
    // Botão "Calcular" (Oculto)
    btnCalculatePassword.addEventListener('click', () => {
        const code = parseInt(licenseCodeInput.value);
        const days = parseInt(licenseDaysInput.value) || 30;
        
        if (!code || isNaN(code)) {
            // alert('Por favor, gere um código primeiro.');
            return;
        }
        const password = calculatePassword(code, days);
        passwordResultInput.value = password;
    });
    
    btnActivateLicense.addEventListener('click', () => {
        const licenseString = licenseInput.value.trim();
        const validation = validateLicense(licenseString);
        
        if (!validation) {
            alert('Licença inválida! Formato correto: XXXXXX-YY (onde YY é o número de dias). Exemplo: 139405-31');
            return;
        }
        
        const { calculation, days } = validation;
        
        // Recalcula a validade baseada no input
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + days);
        
        const licenseData = {
            license: licenseString,
            activationDate: new Date().toISOString(),
            expiryDate: expiryDate.toISOString(),
            days: days
        };
        
        localStorage.setItem('pme_calculator_license', JSON.stringify(licenseData));
        
        // Mostra informações da licença
        licenseInfo.classList.remove('hidden');
        licenseDetails.textContent = `Licença ativada com sucesso para ${days} dias.`;
        licenseExpiry.textContent = `Expira em: ${expiryDate.toLocaleDateString()}`;
        
        // Atualiza status no rodapé e desbloqueia UI
        checkLicenseExpiry();
        
        // Habilita funcionalidades se estavam desativadas
        const calculateBtn = document.querySelector('#financial-form button[type="submit"]');
        if (calculateBtn) {
            calculateBtn.disabled = false;
            calculateBtn.textContent = 'Calcular 25 Indicadores 🚀';
            calculateBtn.style.opacity = '1';
        }
        
        alert('Licença ativada com sucesso!');
        licenseInput.value = ''; // Limpa o campo
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
    const cloudStatus = document.getElementById('cloud-status');
    const licenseDisplay = document.getElementById('license-display');
    const btnAddCredits = document.getElementById('btn-add-credits');
    const btnDonateItems = document.querySelectorAll('.btn-donate');

    // License Modal Elements
    // (Declarados acima na seção de novas funcionalidades)

    let currentRandomNumber = 0;

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
    document.getElementById('btn-google-login').addEventListener('click', handleGoogleLogin);
    
    btnLogout.addEventListener('click', handleLogout);
    if(btnAddCredits) btnAddCredits.addEventListener('click', openLicenseModal);
    
    // Botões de Doação
    btnDonateItems.forEach(btn => {
        btn.addEventListener('click', handleDonation);
    });

    let currentUserEmail = null; 
    let currentUserData = null; // Armazena dados completos incluindo licença

    // Verificar sessão existente (Local)
    checkSession();

    // Listener de estado do Firebase
    if (auth) {
        auth.onAuthStateChanged(function(user) {
            if (user) {
                const appUser = {
                    name: user.displayName || user.email.split('@')[0],
                    email: user.email,
                    pass: 'google-auth'
                };
                // Ao logar com Google, verifica se já tem dados para validar licença
                // Se não tiver (primeiro acesso), cria estrutura inicial
                checkAndCreateUserStructure(appUser);
            } else {
                const loggedUser = sessionStorage.getItem('pme_logged_user');
                if (!loggedUser) {
                    showAuth();
                }
            }
        });
    }

    function switchAuthView(viewToShow) {
        viewLogin.classList.add('hidden');
        viewRegister.classList.add('hidden');
        viewForgot.classList.add('hidden');
        viewToShow.classList.remove('hidden');
    }

    function checkSession() {
        const loggedUser = sessionStorage.getItem('pme_logged_user');
        if (loggedUser) {
            const user = JSON.parse(loggedUser);
            // Para usuários locais, precisamos carregar os dados do localStorage para checar a licença
            const usersDb = getUsersDb();
            const fullUser = usersDb.find(u => u.email === user.email);
            
            if (fullUser) {
                handleAppStart(fullUser);
            } else {
                // Fallback se algo estiver corrompido
                handleAppStart(user); 
            }
        }
    }

    // Função Central para iniciar o app após login (Local ou Firebase)
    function checkAndCreateUserStructure(user) {
        if (db) {
            // Verifica se existe no Firestore
            db.collection('user_data').doc(user.email).get().then((doc) => {
                if (doc.exists) {
                    // Usuário existe, usa dados da nuvem
                    handleAppStart({ ...user, ...doc.data() });
                } else {
                    // Novo usuário Firebase: Cria com 30 dias de licença
                    const newUser = {
                        ...user,
                        license: {
                            validUntil: Date.now() + (30 * 24 * 60 * 60 * 1000)
                        }
                    };
                    db.collection('user_data').doc(user.email).set(newUser).then(() => {
                        handleAppStart(newUser);
                    });
                }
            }).catch(err => {
                console.error("Erro ao verificar usuário nuvem:", err);
                handleAppStart(user); // Fallback offline
            });
        } else {
            handleAppStart(user);
        }
    }

    function handleAppStart(user) {
        currentUserEmail = user.email;
        currentUserData = user;

        // Verifica Licença
        checkLicenseValidity();

        authSection.classList.add('hidden');
        mainApp.classList.remove('hidden'); // Exibe a área principal
        userArea.classList.remove('hidden');
        userWelcome.textContent = `Olá, ${user.name}`;
        
        // Carregar dados salvos do formulário
        loadUserData(user.email);
    }

    function openLicenseModal() {
        licenseModal.classList.add('active');
        // randomCodeDisplay.classList.add('hidden'); // Elemento não existe no HTML novo
        if(document.getElementById('random-code-display')) {
             document.getElementById('random-code-display').classList.add('hidden');
        }
        if(unlockInput) unlockInput.value = '';
    }

    // As funções verifyUnlockCode e updateUserLicense foram substituídas pela lógica de licença acima
    // mas a lógica de handleRegister agora prioriza o Firebase Auth para "Usuários apenas na nuvem"

    function showAuth() {
        currentUserEmail = null;
        currentUserData = null;
        authSection.classList.remove('hidden');
        mainApp.classList.add('hidden');
        userArea.classList.add('hidden');
        switchAuthView(viewLogin);
    }

    function getUsersDb() {
        const users = localStorage.getItem('pme_calculator_users');
        return users ? JSON.parse(users) : [];
    }

    function saveUserDb(users) {
        localStorage.setItem('pme_calculator_users', JSON.stringify(users));
    }

    function handleRegister() {
        const name = document.getElementById('reg-name').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const pass = document.getElementById('reg-pass').value.trim();

        if (!name || !email || !pass) {
            alert("Por favor, preencha todos os campos.");
            return;
        }

        // Tenta criar no Firebase (Usuários Apenas na Nuvem)
        if (auth) {
            auth.createUserWithEmailAndPassword(email, pass)
            .then((userCredential) => {
                // Atualiza perfil e salva licença inicial
                userCredential.user.updateProfile({displayName: name});
                
                // Cria documento inicial com licença trial
                const now = new Date();
                const expiryDate = new Date();
                expiryDate.setDate(now.getDate() + 30);
                
                db.collection('user_data').doc(email).set({
                    license: { 
                        validUntil: expiryDate.getTime(),
                        type: 'TRIAL'
                    }
                });
                
                alert("Conta criada com sucesso na nuvem! Você ganhou 30 dias de acesso.");
                switchAuthView(viewLogin);
            })
            .catch((error) => {
                alert("Erro ao criar conta: " + error.message);
            });
        } else {
            // Fallback Local (apenas se Firebase falhar/não existir, para não quebrar o app)
            const users = getUsersDb();
            if (users.find(u => u.email === email)) {
                alert("E-mail já cadastrado.");
                return;
            }
            const newUser = { name, email, pass };
            users.push(newUser);
            saveUserDb(users);
            alert("Conta criada localmente (Offline).");
            switchAuthView(viewLogin);
        }
        
        // Limpar campos
        document.getElementById('reg-name').value = '';
        document.getElementById('reg-email').value = '';
        document.getElementById('reg-pass').value = '';
    }

    function handleLogin() {
        const email = document.getElementById('login-email').value.trim();
        const pass = document.getElementById('login-pass').value.trim();

        if (!email || !pass) {
            alert("Preencha e-mail e senha.");
            return;
        }

        // Tenta login no Firebase
        if (auth) {
            auth.signInWithEmailAndPassword(email, pass)
            .then((userCredential) => {
                // O onAuthStateChanged vai lidar com o resto
            })
            .catch((error) => {
                // Se falhar no Firebase, tenta local (para usuários legados ou offline)
                const users = getUsersDb();
                const user = users.find(u => u.email === email && u.pass === pass);

                if (user) {
                    sessionStorage.setItem('pme_logged_user', JSON.stringify(user));
                    handleAppStart(user);
                } else {
                    alert("E-mail ou senha incorretos (Nuvem e Local).");
                }
            });
        } else {
            // Apenas local
            const users = getUsersDb();
            const user = users.find(u => u.email === email && u.pass === pass);

            if (user) {
                sessionStorage.setItem('pme_logged_user', JSON.stringify(user));
                handleAppStart(user);
            } else {
                alert("E-mail ou senha incorretos.");
            }
        }
        
        // Limpar campos
        document.getElementById('login-email').value = '';
        document.getElementById('login-pass').value = '';
    }

    function handleGoogleLogin() {
        if (!auth) {
            alert("Erro de configuração do Firebase.");
            return;
        }
        auth.signInWithPopup(googleProvider)
            .then((result) => {
                console.log("Logado com Google:", result.user);
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
                        alert(`E-mail de recuperação enviado para ${email} (via Firebase).`);
                        switchAuthView(viewLogin);
                })
                .catch((error) => {
                    alert(`Se o e-mail ${email} estiver cadastrado, você receberá um link de recuperação em instantes.`);
                    switchAuthView(viewLogin);
                });
        } else {
            alert(`Se o e-mail ${email} estiver cadastrado, você receberá um link de recuperação em instantes.`);
            switchAuthView(viewLogin);
        }
    }

    function handleLogout() {
        sessionStorage.removeItem('pme_logged_user');
        if (auth) {
            auth.signOut().then(() => {
                showAuth();
            });
        } else {
            showAuth();
        }
    }

    // --- SISTEMA DE SALVAMENTO ---
    function saveUserData(email) {
        if (!email) return;
        
        const inputs = getFormInputs();
        const dataToSave = JSON.stringify(inputs);
        
        // Salva Local (Backup imediato)
        localStorage.setItem(`pme_autosave_${email}`, dataToSave);
        updateCloudStatus("Salvando...", "orange");

        // Salva Nuvem (Se disponível)
        if (db) {
            db.collection('user_data').doc(email).set(inputs, { merge: true })
            .then(() => {
                updateCloudStatus("☁️ Salvo na Nuvem", "#28a745");
            })
            .catch((error) => {
                console.error("Erro ao salvar na nuvem:", error);
                updateCloudStatus("💾 Salvo Local (Offline)", "#6c757d");
            });
        } else {
            updateCloudStatus("💾 Salvo Local", "#6c757d");
        }
    }

    function loadUserData(email) {
        if (!email) return;
        updateCloudStatus("Carregando...", "orange");

        if (db) {
            db.collection('user_data').doc(email).get().then((doc) => {
                if (doc.exists) {
                    populateForm(doc.data());
                    updateCloudStatus("☁️ Sincronizado", "#28a745");
                } else {
                    loadLocalData(email);
                }
            }).catch((error) => {
                console.error("Erro ao carregar da nuvem:", error);
                loadLocalData(email);
            });
        } else {
            loadLocalData(email);
        }
    }

    function loadLocalData(email) {
        const localData = localStorage.getItem(`pme_autosave_${email}`);
        if (localData) {
            try {
                const inputs = JSON.parse(localData);
                populateForm(inputs);
                updateCloudStatus("💾 Carregado Local", "#6c757d");
            } catch (e) {
                console.error("Erro ao ler backup local", e);
            }
        } else {
            updateCloudStatus("Pronto", "#28a745");
        }
    }

    function populateForm(data) {
        for (const [key, value] of Object.entries(data)) {
            // Ignora chaves de controle (licença)
            if (key === 'license') continue;
            
            const input = document.getElementById(key);
            if (input) {
                input.value = value;
            }
        }
    }

    function updateCloudStatus(text, color) {
        if (cloudStatus) {
            cloudStatus.textContent = text;
            cloudStatus.style.borderLeft = `3px solid ${color}`;
        }
    }

    let saveTimeout;
    const formInputs = form.querySelectorAll('input');
    formInputs.forEach(input => {
        input.addEventListener('input', () => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                saveUserData(currentUserEmail);
            }, 1000);
        });
    });


    // --- Seletores do DOM da Aplicação ---
    const tabButtons = document.querySelectorAll('.app-nav button');
    const tabSections = document.querySelectorAll('.app-section');
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

    // Backup Elements
    const btnBackup = document.getElementById('btn-backup');
    const btnRestoreTrigger = document.getElementById('btn-restore-trigger');
    const fileRestoreInput = document.getElementById('file-restore');
    const btnDemoData = document.getElementById('btn-demo-data');

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
        // Permite backup mesmo com dados parciais, mas avisa se inválido
        if (!validateForm()) {
            if (!confirm("Alguns campos estão vazios ou inválidos. Deseja fazer o backup mesmo assim?")) {
                return;
            }
        }
        
        const inputs = getFormInputs();
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(inputs, null, 2));
        const downloadAnchorNode = document.createElement('a');
        
        // Adiciona timestamp ao nome do arquivo
        const date = new Date().toISOString().slice(0, 10);
        const time = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
        const filename = `backup_financeiro_${date}_${time}.json`;
        
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", filename);
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
                
                // Popula os campos usando a função centralizada
                populateForm(data);
                validateForm(); // Remove erros visuais se houver
                
                // Salva imediatamente para evitar perda se fechar
                if (currentUserEmail) {
                    saveUserData(currentUserEmail);
                }
                
                alert("Dados restaurados com sucesso! Clique em 'Calcular' para ver os resultados.");
                
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
            const demoValues = {
                'faturamentoBruto': 80000,
                'custosVariaveis': 36000,
                'custosFixos': 22000,
                'numeroVendas': 650,
                'impostos': 5500,
                'ativosTotais': 120000,
                'patrimonioLiquido': 70000,
                'ativosCirculantes': 45000,
                'passivosCirculantes': 25000,
                'investimentoInicial': 90000
            };

            populateForm(demoValues);
            
            // Remove alertas visuais de erro se houver
            validateForm();
            
            // Salva imediatamente para evitar perda se a aba for fechada
            if (currentUserEmail) {
                saveUserData(currentUserEmail);
            }
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
            saveUserData(currentUserEmail); // Salva explicitamente ao calcular
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

        let csvContent = "data:text/csv;charset=utf-8," + encodeURI("Indicador,Valor Formatado,Categoria,Descricao\r\n");

        calculatedResults.forEach(item => {
            const row = [
                `"${item.name}"`,
                `"${item.formattedValue.replace('R$ ', '')}"`, 
                `"${item.category}"`,
                `"${item.description.replace(/"/g, '""')}"` 
            ].join(",");
            csvContent += row + "\r\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
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
    
    exportCsvBtn.addEventListener('click', exportToCSV);
    copyClipboardBtn.addEventListener('click', copyToClipboard);

});
```
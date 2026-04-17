const loginOptionsCancelContainer = document.getElementById('loginOptionCancelContainer')
const loginOptionMicrosoft = document.getElementById('loginOptionMicrosoft')
const loginOptionMojang = document.getElementById('loginOptionMojang')
const loginOptionOffline = document.getElementById('loginOptionOffline')
const loginOptionsCancelButton = document.getElementById('loginOptionCancelButton')
const offlineLoginForm = document.getElementById('offlineLoginForm')
const offlineNicknameInput = document.getElementById('offlineNicknameInput')
const offlineNicknameError = document.getElementById('offlineNicknameError')
const offlineLoginButton = document.getElementById('offlineLoginButton')

let loginOptionsCancellable = false

let loginOptionsViewOnLoginSuccess
let loginOptionsViewOnLoginCancel
let loginOptionsViewOnCancel
let loginOptionsViewCancelHandler

function loginOptionsCancelEnabled(val){
    if(val){
        $(loginOptionsCancelContainer).show()
    } else {
        $(loginOptionsCancelContainer).hide()
    }
}

loginOptionMicrosoft.onclick = (e) => {
    switchView(getCurrentView(), VIEWS.waiting, 500, 500, () => {
        ipcRenderer.send(
            MSFT_OPCODE.OPEN_LOGIN,
            loginOptionsViewOnLoginSuccess,
            loginOptionsViewOnLoginCancel
        )
    })
}

loginOptionMojang.onclick = (e) => {
    switchView(getCurrentView(), VIEWS.login, 500, 500, () => {
        loginViewOnSuccess = loginOptionsViewOnLoginSuccess
        loginViewOnCancel = loginOptionsViewOnLoginCancel
        loginCancelEnabled(true)
    })
}

loginOptionsCancelButton.onclick = (e) => {
    switchView(getCurrentView(), loginOptionsViewOnCancel, 500, 500, () => {
        // Clear login values (Mojang login)
        // No cleanup needed for Microsoft.
        loginUsername.value = ''
        loginPassword.value = ''
        offlineNicknameInput.value = ''
        $(offlineLoginForm).hide()
        offlineNicknameError.style.opacity = 0
        if(loginOptionsViewCancelHandler != null){
            loginOptionsViewCancelHandler()
            loginOptionsViewCancelHandler = null
        }
    })
}

// Offline login logic

const validOfflineUsername = /^[a-zA-Z0-9_]{1,16}$/

loginOptionOffline.onclick = (e) => {
    $(offlineLoginForm).slideToggle(200)
    offlineNicknameInput.focus()
}

offlineNicknameInput.addEventListener('input', (e) => {
    const val = e.target.value
    if(val.length === 0) {
        offlineLoginButton.disabled = true
        offlineNicknameError.style.opacity = 0
    } else if(!validOfflineUsername.test(val)) {
        offlineLoginButton.disabled = true
        offlineNicknameError.innerHTML = Lang.queryJS('loginOptions.offlineNicknameError')
        offlineNicknameError.style.opacity = 1
    } else {
        offlineLoginButton.disabled = false
        offlineNicknameError.style.opacity = 0
    }
})

offlineNicknameInput.addEventListener('keydown', (e) => {
    if(e.key === 'Enter' && !offlineLoginButton.disabled) {
        offlineLoginButton.click()
    }
})

offlineLoginButton.addEventListener('click', () => {
    const nickname = offlineNicknameInput.value
    if(!validOfflineUsername.test(nickname)) {
        return
    }

    offlineLoginButton.disabled = true
    offlineNicknameInput.disabled = true

    const account = AuthManager.addOfflineAccount(nickname)
    updateSelectedAccount(account)

    switchView(getCurrentView(), loginOptionsViewOnLoginSuccess, 500, 500, () => {
        offlineNicknameInput.value = ''
        offlineNicknameInput.disabled = false
        offlineLoginButton.disabled = true
        $(offlineLoginForm).hide()
        offlineNicknameError.style.opacity = 0
        loginOptionsCancelEnabled(false)
        loginOptionsViewCancelHandler = null
    })
})
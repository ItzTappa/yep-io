// Firebase (accounts + saved progress). The SDK is loaded on demand, so the game still works as a
// guest if Firebase is blocked or down (e.g. school networks).
//
// These keys are meant to be public; your data is protected by the Firestore rules in
// /firestore.rules (publish them in the Firebase console: Firestore Database > Rules).
const SDK_URL = 'https://www.gstatic.com/firebasejs/10.8.1/';

export const firebaseConfig = {
    apiKey: 'AIzaSyD1jhU8Z7EkxMqMop4cM0jrQ6aLBnzHmeE',
    authDomain: 'yep-io-6a50d.firebaseapp.com',
    projectId: 'yep-io-6a50d',
    storageBucket: 'yep-io-6a50d.firebasestorage.app',
    messagingSenderId: '956171272863',
    appId: '1:956171272863:web:5aa42a88cf78ff4b7698aa'
};

// Accounts are Firebase email/password users with a made-up email: "<username>@yepio.game".
export const EMAIL_DOMAIN = '@yepio.game';

let loading = null;

export function loadFirebase() {
    if (!loading) {
        loading = (async () => {
            const [appSdk, authSdk, db] = await Promise.all([
                import(`${SDK_URL}firebase-app.js`),
                import(`${SDK_URL}firebase-auth.js`),
                import(`${SDK_URL}firebase-firestore.js`)
            ]);
            const app = appSdk.initializeApp(firebaseConfig);
            return {
                auth: authSdk.getAuth(app),
                db: db.getFirestore(app),
                authSdk,
                fs: db
            };
        })();
    }
    return loading;
}

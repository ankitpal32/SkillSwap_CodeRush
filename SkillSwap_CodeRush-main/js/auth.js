import { auth, db } from './firebase.js';
import {
	createUserWithEmailAndPassword,
	signInWithEmailAndPassword,
	signOut,
	sendEmailVerification,
	updateProfile,
	onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { doc, setDoc, serverTimestamp, getDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

async function signUp(name, email, password) {
	try {
		const userCredential = await createUserWithEmailAndPassword(auth, email, password);
		if (name) {
			await updateProfile(userCredential.user, { displayName: name });
		}
		await sendEmailVerification(userCredential.user);
		// create user document in Firestore
		try{
			const uref = doc(db, 'users', userCredential.user.uid);
			await setDoc(uref, {
				name: name || userCredential.user.email || null,
				email: email,
				credits: 1,
				role: 'student',
				createdAt: serverTimestamp()
			}, { merge: true });
		}catch(e){ console.warn('Failed to create user doc:', e); }
		// show modal with resend option
		showVerificationModal(email);
		// persist a lightweight current user for legacy dashboard code
		localStorage.setItem('ss_current_v1', JSON.stringify({ id: userCredential.user.uid, name: name || email, role: 'student' }));
		return userCredential.user;
	} catch (err) {
		// let caller handle errors (e.g., show inline messages)
		throw err;
	}
}

async function login(email, password) {
	try {
		const userCredential = await signInWithEmailAndPassword(auth, email, password);
		if (!userCredential.user.emailVerified) {
			alert('Please verify your email before continuing.');
			return null;
		}
		// ensure firestore user doc exists and persist lightweight current user for legacy code
		try{
			const uref = doc(db, 'users', userCredential.user.uid);
			const snap = await getDoc(uref);
			if(!snap.exists()){
				await setDoc(uref, { name: userCredential.user.displayName || userCredential.user.email, email: userCredential.user.email, credits:1, role:'student', createdAt: serverTimestamp() });
			}
		}catch(e){ console.warn('Error ensuring user doc:', e); }
		localStorage.setItem('ss_current_v1', JSON.stringify({ id: userCredential.user.uid, name: userCredential.user.displayName || userCredential.user.email, role: 'student' }));
		return userCredential.user;
	} catch (err) {
		alert(err.message);
		throw err;
	}
}

function logout() {
	// clear local demo session and sign out
	localStorage.removeItem('ss_current_v1');
	return signOut(auth);
}

// Wire up the forms if present on the page
document.addEventListener('DOMContentLoaded', () => {
	const signupForm = document.getElementById('signup');
	if (signupForm) {
		signupForm.addEventListener('submit', async (e) => {
			e.preventDefault();
			const name = document.getElementById('signup-name').value.trim();
			const email = document.getElementById('signup-email').value.trim();
			const password = document.getElementById('signup-password').value;
			const signupErrorEl = document.getElementById('signup-error');
			if (signupErrorEl) signupErrorEl.textContent = '';
			try {
				await signUp(name, email, password);
				signupForm.reset();
			} catch (err) {
				console.error(err);
				if (signupErrorEl) {
					if (err && err.code === 'auth/email-already-in-use') {
						signupErrorEl.textContent = 'User already exists — please login.';
						// switch to login view
						window.location.hash = '#login';
					} else {
						signupErrorEl.textContent = err && err.message ? err.message : 'Error creating account.';
					}
				}
			}
		});
	}

	const loginForm = document.getElementById('login');
	if (loginForm) {
		loginForm.addEventListener('submit', async (e) => {
			e.preventDefault();
			const email = document.getElementById('login-email').value.trim();
			const password = document.getElementById('login-password').value;
			const loginErrorEl = document.getElementById('login-error');
			if (loginErrorEl) loginErrorEl.textContent = '';
			try {
				const user = await login(email, password);
				if (user) {
					window.location.href = 'dasboard1.html';
				}
			} catch (err) {
				console.error(err);
				if (loginErrorEl) loginErrorEl.textContent = err && err.message ? err.message : 'Login failed.';
			}
		});
	}

	// password toggle buttons
	document.querySelectorAll('.toggle-password').forEach((btn) => {
		const targetId = btn.dataset.target;
		const input = document.getElementById(targetId);
		if (!input) return;
		btn.addEventListener('click', () => {
			if (input.type === 'password') {
				input.type = 'text';
				btn.textContent = '🙈';
			} else {
				input.type = 'password';
				btn.textContent = '👁️';
			}
		});
	});
});

// Optional: observe auth state changes
onAuthStateChanged(auth, (user) => {
	if (user) {
		console.log('Signed in:', user.email, 'Verified:', user.emailVerified);
	} else {
		console.log('No user signed in');
	}
});

// Show the verification modal (simple implementation)
function showVerificationModal(email) {
	const modal = document.getElementById('verification-modal');
	const msg = document.getElementById('verification-message');
	const resendBtn = document.getElementById('resend-verification-btn');
	const closeBtn = document.getElementById('close-verification-btn');
	if (!modal || !msg) return;
	msg.textContent = `Verification email sent to ${email || (auth.currentUser && auth.currentUser.email) || ''}.`;
	modal.style.display = 'flex';

	function handleResend() {
		if (!auth.currentUser) {
			alert('No signed-in user to resend verification.');
			return;
		}
		sendEmailVerification(auth.currentUser)
			.then(() => alert('Verification email resent.'))
			.catch((e) => alert('Error sending verification: ' + e.message));
	}

	function handleClose() {
		modal.style.display = 'none';
		resendBtn.removeEventListener('click', handleResend);
		closeBtn.removeEventListener('click', handleClose);
	}

	resendBtn.addEventListener('click', handleResend);
	closeBtn.addEventListener('click', handleClose);
}

export { signUp, login, logout, showVerificationModal };

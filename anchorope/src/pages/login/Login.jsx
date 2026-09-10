import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { apiUrl } from '../../api';

const Login = () => {
	const [formData, setFormData] = useState({ email: '', password: '' });
	const [error, setError] = useState(() => new URLSearchParams(window.location.search).get('error') || '');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const navigate = useNavigate();

	const handleChange = (event) => {
		setFormData({ ...formData, [event.target.name]: event.target.value });
	};

	const handleSubmit = async (event) => {
		event.preventDefault();
		setError('');
		setIsSubmitting(true);

		try {
			const response = await fetch('/api/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify(formData),
			});
			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Login failed');
			}

			localStorage.setItem('user', JSON.stringify(result.user));
			navigate('/products', { replace: true });
		} catch (submitError) {
			setError(submitError.message || 'The login server is unavailable.');
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<main className="auth-page">
			<section className="auth-panel" aria-labelledby="login-title">
				<p className="eyebrow">Welcome back</p>
				<h1 id="login-title">Sign in to AnchoRope</h1>
				<p className="auth-intro">Continue to your account and pick up where you left off.</p>

				<div className="social-login" aria-label="Third-party sign in">
					<a className="social-button" href={`${apiUrl}/api/auth/google`} style={styles.googleButton}>
						<img 
						src="https://www.google.com/favicon.ico" 
						alt="Google" 
						style={styles.buttonIcon}
						/>
						Enter by Google
					</a>
					<a className="social-button" href={`${apiUrl}/api/auth/facebook`} style={styles.facebookButton}>
        				<span style={styles.facebookIcon}>f</span>
        				Enter by Facebook
					</a>
				</div>

				<div className="divider"><span>or use your email</span></div>

				<form className="auth-form" onSubmit={handleSubmit}>
					<label htmlFor="email">Email</label>
					<input
						id="email"
						type="email"
						name="email"
						autoComplete="username"
						value={formData.email}
						onChange={handleChange}
						required
					/>

					<div className="password-label-row">
						<label htmlFor="password">Password</label>
						<button
							className="text-button"
							type="button"
							onClick={() => setShowPassword(!showPassword)}
							aria-label={showPassword ? 'Hide password' : 'Show password'}
							aria-pressed={showPassword}
						>
							{showPassword ? 'Hide' : 'Show'}
						</button>
					</div>
					<input
						id="password"
						type={showPassword ? 'text' : 'password'}
						name="password"
						autoComplete="current-password"
						value={formData.password}
						onChange={handleChange}
						required
					/>

					{error && <p className="form-error" role="alert">{error}</p>}
					<button className="submit-button" type="submit" disabled={isSubmitting}>
						{isSubmitting ? 'Signing in...' : 'Sign in'}
					</button>
				</form>

				<p className="auth-footer">
					New to AnchoRope? <Link to="/registration">Create an account</Link>
				</p>
			</section>
		</main>
	);
};


// Стили
const styles = {
  container: {
    maxWidth: '400px',
    margin: '0 auto',
    padding: '20px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  input: {
    padding: '10px',
    fontSize: '16px',
    border: '1px solid #ccc',
    borderRadius: '4px',
  },
  button: {
    padding: '10px',
    fontSize: '16px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  divider: {
    textAlign: 'center',
    margin: '20px 0',
    position: 'relative',
  },
  googleButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    width: '100%',
    padding: '10px',
    fontSize: '16px',
    backgroundColor: 'white',
    color: '#333',
    border: '1px solid #ccc',
    borderRadius: '4px',
    cursor: 'pointer',
    marginBottom: '10px',
  },
  facebookButton: {
    display: 'flex',
	alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    width: '100%',
    padding: '10px',
    fontSize: '16px',
    backgroundColor: '#1877f2',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  buttonIcon: {
    width: '20px',
    height: '20px',
  },
  facebookIcon: {
    width: '20px',
    height: '20px',
    backgroundColor: 'white',
    color: '#1877f2',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
  },
  error: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
    padding: '10px',
    borderRadius: '4px',
    marginBottom: '10px',
  },
};


export default Login;

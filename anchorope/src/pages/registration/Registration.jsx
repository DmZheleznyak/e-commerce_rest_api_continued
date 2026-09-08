import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

const Registartion = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const passwordTooShort = formData.password.length > 0 && formData.password.length < 6;

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });
      const responseText = await response.text();
      let result;

      try {
        result = JSON.parse(responseText);
      } catch {
        throw new Error('Registration server is unavailable. Start the API server on port 3000.');
      }

      if (!response.ok) {
        throw new Error(result.error || 'Registration failed');
      }

      navigate('/products', { replace: true });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="registration-title">
        <p className="eyebrow">Start your account</p>
        <h1 id="registration-title">Create your AnchoRope account</h1>
        <p className="auth-intro">Join AnchoRope to save your cart and complete orders.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="name">Name</label>
        <input
          id="name"
          type="text"
          name="name"
          placeholder="Name"
          value={formData.name}
          onChange={handleChange}
          required
        />
        <label htmlFor="registration-email">Email</label>
        <input
          id="registration-email"
          type="email"
          name="email"
          placeholder="Email"
          value={formData.email}
          onChange={handleChange}
          required
        />
        <div className="password-label-row">
          <label htmlFor="registration-password">Password</label>
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
        <div className="password-input-wrap">
          <input
            id="registration-password"
            type={showPassword ? 'text' : 'password'}
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            minLength={6}
            aria-describedby="password-requirement"
            aria-invalid={passwordTooShort}
            required
          />
        </div>
        {passwordTooShort && (
          <p className="form-error" id="password-requirement" role="alert">
            Password must be at least 6 characters.
          </p>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="submit-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Registration...' : 'Register'}
        </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
};

export default Registartion;
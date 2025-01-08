document.addEventListener('DOMContentLoaded', () => {
  const loginView = document.getElementById('loginView');
  const signupView = document.getElementById('signupView');
  const showSignupLink = document.getElementById('showSignup');
  const showLoginLink = document.getElementById('showLogin');
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');

  showSignupLink.addEventListener('click', (e) => {
      e.preventDefault();
      loginView.classList.add('hidden');
      signupView.classList.remove('hidden');
  });

  showLoginLink.addEventListener('click', (e) => {
      e.preventDefault();
      signupView.classList.add('hidden');
      loginView.classList.remove('hidden');
  });

  loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(loginForm);
      const loginData = Object.fromEntries(formData.entries());

      try {
          const response = await fetch('/api/partTime/login', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
              },
              body: JSON.stringify(loginData),
          });

          if (response.ok) {
              const data = await response.json();
              localStorage.setItem('partTimeToken', data.token);
              window.location.href = 'partTime.html';
          } else {
              const errorData = await response.json();
              alert(`Error: ${errorData.message}`);
          }
      } catch (error) {
          console.error('Error:', error);
          alert('An error occurred. Please try again.');
      }
  });

  signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(signupForm);

      if (formData.get('password') !== formData.get('confirmPassword')) {
          alert('Passwords do not match');
          return;
      }

      try {
          const response = await fetch('/api/partTime/register', {
              method: 'POST',
              body: formData,
          });

          const data = await response.json();

          if (response.ok) {
              alert(data.message);
              signupView.classList.add('hidden');
              loginView.classList.remove('hidden');
          } else {
              alert(`Error: ${data.message}`);
          }
      } catch (error) {
          console.error('Error:', error);
          alert('An error occurred. Please try again.');
      }
  });
});
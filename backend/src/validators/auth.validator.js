
// Validate email address
export const validateEmail = (email) => {
  if (!email || typeof email !== "string") {
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  return emailRegex.test(email.trim());
};


// Validate password strength
export const validatePassword = (password) => {
  const errors = [];

  if (!password || typeof password !== "string") {
    errors.push("Password is required.");
  } else if (password.length < 8 || password.length > 72) {
    errors.push("Password must be between 8 and 72 characters.");
  } else if (
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/[0-9]/.test(password)
  ) {
    errors.push(
      "Password must contain uppercase, lowercase and numeric characters."
    );
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};


// Validate registration details
export const validateRegistration = ({
  fullName,
  email,
  password
}) => {
  const errors = [];

  // Validate full name
  if (!fullName || typeof fullName !== "string") {
    errors.push("Full name is required.");
  } else if (
    fullName.trim().length < 2 ||
    fullName.trim().length > 80
  ) {
    errors.push("Full name must be between 2 and 80 characters.");
  }

  // Validate email
  if (!validateEmail(email)) {
    errors.push("Please enter a valid email address.");
  }

  // Validate password
  const passwordValidation = validatePassword(password);

  errors.push(...passwordValidation.errors);

  return {
    isValid: errors.length === 0,
    errors
  };
};

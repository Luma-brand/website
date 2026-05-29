import { useState } from "react";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";

const initialForm = {
  name: "",
  email: "",
  interest: "Product launch",
};

export function WaitlistForm() {
  const [formData, setFormData] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));

    setErrors((current) => ({
      ...current,
      [name]: "",
    }));
  }

  function validateForm() {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Please enter your name.";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Please enter your email.";
    } else if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address.";
    }

    return newErrors;
  }

  function handleSubmit(event) {
    event.preventDefault();

    const validationErrors = validateForm();

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    console.log("LUMA waitlist submission:", formData);

    setIsSubmitted(true);
    setFormData(initialForm);
  }

  if (isSubmitted) {
    return (
      <div className="waitlist-success">
        <CheckCircle2 size={26} />
        <div>
          <h3>You’re on the LUMA list.</h3>
          <p>We’ll keep you updated about product drops, launch news, and beauty rituals.</p>
        </div>
      </div>
    );
  }

  return (
    <form className="waitlist-form" onSubmit={handleSubmit} noValidate>
      <div className="form-field">
        <label htmlFor="waitlist-name">Name</label>
        <input
          id="waitlist-name"
          type="text"
          name="name"
          placeholder="Your name"
          value={formData.name}
          onChange={handleChange}
        />
        {errors.name && <small>{errors.name}</small>}
      </div>

      <div className="form-field">
        <label htmlFor="waitlist-email">Email</label>
        <input
          id="waitlist-email"
          type="email"
          name="email"
          placeholder="you@example.com"
          value={formData.email}
          onChange={handleChange}
        />
        {errors.email && <small>{errors.email}</small>}
      </div>

      <div className="form-field">
        <label htmlFor="waitlist-interest">I’m interested in</label>
        <select
          id="waitlist-interest"
          name="interest"
          value={formData.interest}
          onChange={handleChange}
        >
          <option>Product launch</option>
          <option>Retail / stockist enquiry</option>
          <option>Partnership</option>
          <option>Beauty studio enquiry</option>
        </select>
      </div>

      <button type="submit" className="waitlist-button">
        Join waitlist
        <ArrowUpRight size={17} />
      </button>
    </form>
  );
}
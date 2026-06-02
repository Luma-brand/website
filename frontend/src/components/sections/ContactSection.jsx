import { ArrowUpRight, Mail } from "lucide-react";
import { motion } from "framer-motion";
import { submitContactForm } from "../../services/api";


export function ContactSection() {
  const handleSubmit = async (e) => {
  e.preventDefault();

  try {
    setIsSubmitting(true);

    await submitContactForm({
      fullName: formData.fullName,
      email: formData.email,
      phone: formData.phone,
      subject: formData.subject,
      message: formData.message,
    });

    alert("Message sent successfully!");

    setFormData({
      fullName: "",
      email: "",
      phone: "",
      subject: "",
      message: "",
    });
  } catch (error) {
    alert(error.message || "Failed to send message");
  } finally {
    setIsSubmitting(false);
  }
};
  return (
    <section id="contact" className="contact-section">
      <motion.div
        className="contact-card"
        initial={{ opacity: 0, y: 26 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.35 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="contact-content">
          <p className="eyebrow">Stockists & enquiries</p>
          <h2>Bring LUMA into your beauty shelf, studio, or store.</h2>
          <p>
            For product enquiries, partnerships, retail interest, or launch
            updates, reach out to the LUMA team.
          </p>
        </div>

        <div className="contact-actions">
          <a href="mailto:hello@luma.com" className="contact-email">
            <Mail size={18} />
            hello@luma.com
          </a>

          <a  href="mailto:hello@luma.com?subject=LUMA Enquiry&body=Hello LUMA, I would like to make an enquiry." className="btn btn-primary">
            Send enquiry
            <ArrowUpRight size={18} />
          </a>
        </div>
      </motion.div>
    </section>
  );
}
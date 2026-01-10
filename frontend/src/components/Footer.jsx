/**
 * Footer Component
 * 
 * Edit FOOTER_TEXT below to change the footer everywhere in the app.
 */
import { useTheme } from '../context/ThemeContext';

// ============================================
// EDIT THIS TEXT TO CHANGE FOOTER EVERYWHERE
// ============================================
const FOOTER_TEXT = "© 2026 Designed by Omar G McLeod";
// ============================================

// Footer for auth pages (Login, Register, etc.)
export const AuthFooter = () => {
  return (
    <p className="text-center text-indigo-200 text-sm mt-8">
      {FOOTER_TEXT}
    </p>
  );
};

// Footer for dashboard pages - uses theme colors
export const DashboardFooter = () => {
  const { colors } = useTheme();
  
  return (
    <footer className={`${colors.bgCard} border-t ${colors.border} px-6 py-3`}>
      <p className={`text-center text-sm ${colors.textMuted}`}>
        {FOOTER_TEXT}
      </p>
    </footer>
  );
};

export default AuthFooter;

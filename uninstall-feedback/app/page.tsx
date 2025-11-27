'use client';

import { useState } from 'react';

export default function UninstallFeedback() {
  const [whyUninstall, setWhyUninstall] = useState('');
  const [improvements, setImprovements] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);

    try {
      const response = await fetch('https://formspree.io/f/xblvkgza', {
        method: 'POST',
        body: formData,
        headers: {
          Accept: 'application/json',
        },
      });

      if (response.ok) {
        setSubmitted(true);
      }
    } catch (error) {
      console.error('Error submitting form:', error);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Thank you for your feedback!
          </h1>
          <p className="text-gray-600 dark:text-gray-300 text-lg">
            We appreciate you taking the time to help us improve Focus Shield.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2 text-center">
          We&apos;re sorry to see you go
        </h1>
        <p className="text-gray-600 dark:text-gray-300 text-center mb-8">
          Your feedback helps us improve Focus Shield for everyone
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="why-uninstall"
              className="block text-lg font-medium text-gray-900 dark:text-white mb-2"
            >
              Why did you uninstall?
            </label>
            <textarea
              id="why-uninstall"
              name="why-uninstall"
              value={whyUninstall}
              onChange={(e) => setWhyUninstall(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
              rows={4}
              placeholder="Tell us what made you decide to uninstall..."
            />
          </div>

          <div>
            <label
              htmlFor="improvements"
              className="block text-lg font-medium text-gray-900 dark:text-white mb-2"
            >
              What can we improve?
            </label>
            <textarea
              id="improvements"
              name="improvements"
              value={improvements}
              onChange={(e) => setImprovements(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
              rows={4}
              placeholder="Share any suggestions or features you'd like to see..."
            />
          </div>

          <button
            type="submit"
            disabled={!whyUninstall.trim() && !improvements.trim()}
            className={`block w-full text-center font-semibold py-4 px-6 rounded-lg transition-colors text-lg ${
              !whyUninstall.trim() && !improvements.trim()
                ? 'bg-gray-400 cursor-not-allowed text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            Send Feedback
          </button>

          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
            Your feedback will be sent directly to us
          </p>
        </form>

        <div className="pt-6 mt-6 border-t border-gray-200 dark:border-gray-700">
          <p className="text-center text-gray-600 dark:text-gray-400 mb-4">
            Changed your mind?
          </p>
          <a
            href="https://chromewebstore.google.com/detail/ai-site-blocker/ibmmihgadnkilmknmfmohlclogcifboj"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 border-2 border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold py-4 px-6 rounded-lg transition-colors text-lg"
          >
            Reinstall Focus Shield
          </a>
        </div>
      </div>
    </div>
  );
}

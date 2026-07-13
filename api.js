/**
 * MRG Experiment - API Client (Google Sheets)
 * Posts all data in a single batch to a Google Apps Script Web App
 */

const API = {
  // Google Apps Script Web App URL
  GAS_URL: 'https://script.google.com/macros/s/AKfycbwMLFXsQxikpNHoCnxVWQ4J2MU7zbW3kQyGNbxzgHKCfH3j_uKZZxBY2VRNbLBc1GyKTA/exec',

  /**
   * Submit all collected data to Google Sheets
   */
  async submitAllData(data) {

    // Google Apps Script usually responds better to 'application/x-www-form-urlencoded' or raw text if CORS is strict,
    // but a standard POST with mode 'no-cors' is the easiest way to bypass CORS on simple setups,
    // though 'no-cors' makes the response opaque. 
    // If the GAS is configured properly to accept JSON and return CORS headers, standard POST works.
    try {
      const response = await fetch(this.GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // 'text/plain' prevents CORS preflight OPTIONS request
        body: JSON.stringify(data)
      });
      
      return await response.json();
    } catch (err) {
      console.error('Failed to submit to Google Sheets:', err);
      throw new Error('Failed to submit data.');
    }
  }
};

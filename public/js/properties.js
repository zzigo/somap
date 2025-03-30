document.addEventListener('DOMContentLoaded', () => {
  // Property form elements
  const propertyForm = document.getElementById('property-form');
  const propertyName = document.getElementById('property-name');
  const propertyDataType = document.getElementById('property-data-type');
  const propertyMin = document.getElementById('property-min');
  const propertyMax = document.getElementById('property-max');
  const propertyMean = document.getElementById('property-mean');
  const propertyDistribution = document.getElementById('property-distribution');
  const propertyUnit = document.getElementById('property-unit');
  const propertyOptions = document.getElementById('property-options');
  const propertyNumberFields = document.getElementById('property-number-fields');
  const propertyEnumFields = document.getElementById('property-enum-fields');
  const propertyApplicableTypes = document.getElementById('property-applicable-types');
  const propertySubmit = document.getElementById('property-submit');
  
  // Predictor form elements
  const predictorForm = document.getElementById('predictor-form');
  const predictorName = document.getElementById('predictor-name');
  const predictorFormula = document.getElementById('predictor-formula');
  const predictorInputProperties = document.getElementById('predictor-input-properties');
  const predictorOutputName = document.getElementById('predictor-output-name');
  const predictorOutputUnit = document.getElementById('predictor-output-unit');
  const predictorOutputType = document.getElementById('predictor-output-type');
  const predictorApplicableTypes = document.getElementById('predictor-applicable-types');
  const predictorConfidence = document.getElementById('predictor-confidence');
  const predictorConfidenceValue = document.getElementById('predictor-confidence-value');
  const predictorSubmit = document.getElementById('predictor-submit');
  const predictorTest = document.getElementById('predictor-test');
  
  // List containers
  const propertiesList = document.getElementById('properties-list');
  const predictorsList = document.getElementById('predictors-list');
  
  // State variables
  let properties = [];
  let predictors = [];
  let types = [];
  
  // Event listeners
  
  // Show/hide conditional fields based on data type selection
  propertyDataType.addEventListener('change', () => {
    // filepath: ssh://hosti/opt/somap/public/js/properties.js
document.addEventListener('DOMContentLoaded', () => {
  // Property form elements
  const propertyForm = document.getElementById('property-form');
  const propertyName = document.getElementById('property-name');
  const propertyDataType = document.getElementById('property-data-type');
  const propertyMin = document.getElementById('property-min');
  const propertyMax = document.getElementById('property-max');
  const propertyMean = document.getElementById('property-mean');
  const propertyDistribution = document.getElementById('property-distribution');
  const propertyUnit = document.getElementById('property-unit');
  const propertyOptions = document.getElementById('property-options');
  const propertyNumberFields = document.getElementById('property-number-fields');
  const propertyEnumFields = document.getElementById('property-enum-fields');
  const propertyApplicableTypes = document.getElementById('property-applicable-types');
  const propertySubmit = document.getElementById('property-submit');
  
  // Predictor form elements
  const predictorForm = document.getElementById('predictor-form');
  const predictorName = document.getElementById('predictor-name');
  const predictorFormula = document.getElementById('predictor-formula');
  const predictorInputProperties = document.getElementById('predictor-input-properties');
  const predictorOutputName = document.getElementById('predictor-output-name');
  const predictorOutputUnit = document.getElementById('predictor-output-unit');
  const predictorOutputType = document.getElementById('predictor-output-type');
  const predictorApplicableTypes = document.getElementById('predictor-applicable-types');
  const predictorConfidence = document.getElementById('predictor-confidence');
  const predictorConfidenceValue = document.getElementById('predictor-confidence-value');
  const predictorSubmit = document.getElementById('predictor-submit');
  const predictorTest = document.getElementById('predictor-test');
  
  // List containers
  const propertiesList = document.getElementById('properties-list');
  const predictorsList = document.getElementById('predictors-list');
  
  // State variables
  let properties = [];
  let predictors = [];
  let types = [];
  
  // Event listeners
  
  // Show/hide conditional fields based on data type selection
  propertyDataType.addEventListener('change', () => {
    
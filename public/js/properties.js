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
  
  // Initial load
  loadProperties();
  loadPredictors();
  loadTypesForForms();
  
  // Event listeners
  
  // Show/hide conditional fields based on data type selection
  propertyDataType?.addEventListener('change', () => {
    const selectedType = propertyDataType.value;
    
    // Hide all conditional fields first
    if (propertyNumberFields) propertyNumberFields.classList.add('hidden');
    if (propertyEnumFields) propertyEnumFields.classList.add('hidden');
    
    // Show appropriate fields based on selection
    if (selectedType === 'number' || selectedType === 'parameterSpace') {
      if (propertyNumberFields) propertyNumberFields.classList.remove('hidden');
    } else if (selectedType === 'enum') {
      if (propertyEnumFields) propertyEnumFields.classList.remove('hidden');
    }
  });
  
  // Update confidence value display
  predictorConfidence?.addEventListener('input', () => {
    if (predictorConfidenceValue) {
      predictorConfidenceValue.textContent = predictorConfidence.value;
    }
  });
  
  // Load available types for both forms
  async function loadTypesForForms() {
    try {
      const response = await fetch('/api/types');
      if (!response.ok) {
        console.error('Failed to fetch types:', response.statusText);
        return;
      }
      
      types = await response.json();
      console.log('Loaded types for property forms:', types);
      
      // Populate applicable types multiselect for properties
      if (propertyApplicableTypes) {
        propertyApplicableTypes.innerHTML = '';
        types.forEach(type => {
          const checkbox = document.createElement('div');
          checkbox.classList.add('flex', 'items-center', 'mb-1');
          checkbox.innerHTML = `
            <input type="checkbox" id="prop-type-${type._key}" value="${type._id || type._key}" class="mr-2">
            <label for="prop-type-${type._key}" class="text-white text-sm">${type.name || 'Unnamed Type'}</label>
          `;
          propertyApplicableTypes.appendChild(checkbox);
        });
      }
      
      // Populate applicable types multiselect for predictors
      if (predictorApplicableTypes) {
        predictorApplicableTypes.innerHTML = '';
        types.forEach(type => {
          const checkbox = document.createElement('div');
          checkbox.classList.add('flex', 'items-center', 'mb-1');
          checkbox.innerHTML = `
            <input type="checkbox" id="pred-type-${type._key}" value="${type._id || type._key}" class="mr-2">
            <label for="pred-type-${type._key}" class="text-white text-sm">${type.name || 'Unnamed Type'}</label>
          `;
          predictorApplicableTypes.appendChild(checkbox);
        });
      }
      
      // Populate input properties for predictors (will be updated when properties load)
      loadPropertiesForPredictorInputs();
    } catch (error) {
      console.error('Error loading types for forms:', error);
    }
  }
  
  // Load properties for predictor inputs
  async function loadPropertiesForPredictorInputs() {
    if (!predictorInputProperties) return;
    
    try {
      if (properties.length === 0) {
        const response = await fetch('/api/properties');
        if (response.ok) {
          properties = await response.json();
        } else {
          console.error('Failed to fetch properties:', response.statusText);
          return;
        }
      }
      
      // Clear and repopulate
      predictorInputProperties.innerHTML = '';
      
      if (properties.length === 0) {
        predictorInputProperties.innerHTML = '<div class="text-lytGrey italic">No properties available. Create some first!</div>';
        return;
      }
      
      properties.forEach(property => {
        const checkbox = document.createElement('div');
        checkbox.classList.add('flex', 'items-center', 'mb-1');
        checkbox.innerHTML = `
          <input type="checkbox" id="input-prop-${property._key}" value="${property._key}" class="mr-2">
          <label for="input-prop-${property._key}" class="text-white text-sm">${property.name} (${property.dataType})</label>
        `;
        predictorInputProperties.appendChild(checkbox);
      });
    } catch (error) {
      console.error('Error loading properties for predictor inputs:', error);
    }
  }
  
  // Load properties and populate list
  async function loadProperties() {
    if (!propertiesList) return;
    
    try {
      const response = await fetch('/api/properties');
      if (!response.ok) {
        console.error('Failed to fetch properties:', response.statusText);
        propertiesList.innerHTML = '<div class="text-lytRed">Error loading properties</div>';
        return;
      }
      
      properties = await response.json();
      console.log('Loaded properties:', properties);
      
      // Clear current list
      propertiesList.innerHTML = '';
      
      if (properties.length === 0) {
        propertiesList.innerHTML = '<div class="text-lytGrey italic">No properties found. Create one!</div>';
        return;
      }
      
      // Add each property to the list
      properties.forEach(property => {
        const propertyElement = document.createElement('div');
        propertyElement.classList.add('property-item', 'flex', 'items-center', 'justify-between', 'py-1', 'text-sm', 'border-b', 'border-dkGrey');
        propertyElement.dataset.id = property._id || property._key;
        
        // Main info
        const nameSpan = document.createElement('span');
        nameSpan.classList.add('property-name', 'flex-grow');
        
        let propDetails = '';
        if (property.dataType === 'number' || property.dataType === 'parameterSpace') {
          propDetails = `${property.min} to ${property.max}${property.unit ? ' ' + property.unit : ''}`;
        } else if (property.dataType === 'enum' && property.options) {
          propDetails = property.options.join(', ');
        }
        
        nameSpan.innerHTML = `
          <span class="font-bold">${property.name}</span> 
          <span class="text-lytGrey text-xs">(${property.dataType})</span>
          ${propDetails ? `<span class="text-lytGrey text-xs ml-2">${propDetails}</span>` : ''}
        `;
        
        // Controls container
        const controls = document.createElement('div');
        controls.classList.add('property-controls', 'flex', 'items-center');
        
        // Edit button
        const editBtn = document.createElement('button');
        editBtn.innerHTML = '<svg class="icon w-4 h-4" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>';
        editBtn.title = 'Edit Property';
        editBtn.classList.add('text-white', 'hover:text-lytOrange', 'mr-2');
        editBtn.addEventListener('click', () => editProperty(property._id || property._key));
        
        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<svg class="icon w-4 h-4" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>';
        deleteBtn.title = 'Delete Property';
        deleteBtn.classList.add('text-white', 'hover:text-lytRed');
        deleteBtn.addEventListener('click', () => deleteProperty(property._id || property._key));
        
        // Assemble the controls
        controls.appendChild(editBtn);
        controls.appendChild(deleteBtn);
        
        // Assemble the property item
        propertyElement.appendChild(nameSpan);
        propertyElement.appendChild(controls);
        
        // Add to list
        propertiesList.appendChild(propertyElement);
      });
      
      console.log(`Loaded ${properties.length} properties`);
      
      // Update predictor inputs after loading properties
      loadPropertiesForPredictorInputs();
    } catch (error) {
      console.error('Error loading properties:', error);
      propertiesList.innerHTML = '<div class="text-lytRed">Error loading properties: ' + error.message + '</div>';
    }
  }
  
  // Load predictors and populate list
  async function loadPredictors() {
    if (!predictorsList) return;
    
    try {
      const response = await fetch('/api/propertyPredictors');
      if (!response.ok) {
        console.error('Failed to fetch predictors:', response.statusText);
        predictorsList.innerHTML = '<div class="text-lytRed">Error loading predictors</div>';
        return;
      }
      
      predictors = await response.json();
      console.log('Loaded predictors:', predictors);
      
      // Clear current list
      predictorsList.innerHTML = '';
      
      if (predictors.length === 0) {
        predictorsList.innerHTML = '<div class="text-lytGrey italic">No predictors found. Create one!</div>';
        return;
      }
      
      // Add each predictor to the list
      predictors.forEach(predictor => {
        const predictorElement = document.createElement('div');
        predictorElement.classList.add('predictor-item', 'flex', 'items-center', 'justify-between', 'py-1', 'text-sm', 'border-b', 'border-dkGrey');
        predictorElement.dataset.id = predictor._id || predictor._key;
        
        // Main info
        const nameSpan = document.createElement('span');
        nameSpan.classList.add('predictor-name', 'flex-grow');
        
        nameSpan.innerHTML = `
          <span class="font-bold">${predictor.name}</span> 
          <span class="text-lytGrey text-xs">(${predictor.output?.name || 'Unknown output'})</span>
          <span class="text-lytGrey text-xs ml-2">Formula: ${predictor.formula}</span>
        `;
        
        // Controls container
        const controls = document.createElement('div');
        controls.classList.add('predictor-controls', 'flex', 'items-center');
        
        // Apply button
        const applyBtn = document.createElement('button');
        applyBtn.textContent = 'Apply';
        applyBtn.title = 'Apply Predictor';
        applyBtn.classList.add('text-white', 'hover:text-lytGreen', 'text-xs', 'border', 'border-lytGrey', 'px-2', 'py-1', 'rounded', 'mr-2');
        applyBtn.addEventListener('click', () => applyPredictor(predictor._id || predictor._key));
        
        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<svg class="icon w-4 h-4" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>';
        deleteBtn.title = 'Delete Predictor';
        deleteBtn.classList.add('text-white', 'hover:text-lytRed');
        deleteBtn.addEventListener('click', () => deletePredictor(predictor._id || predictor._key));
        
        // Assemble the controls
        controls.appendChild(applyBtn);
        controls.appendChild(deleteBtn);
        
        // Assemble the predictor item
        predictorElement.appendChild(nameSpan);
        predictorElement.appendChild(controls);
        
        // Add to list
        predictorsList.appendChild(predictorElement);
      });
      
      console.log(`Loaded ${predictors.length} predictors`);
    } catch (error) {
      console.error('Error loading predictors:', error);
      predictorsList.innerHTML = '<div class="text-lytRed">Error loading predictors: ' + error.message + '</div>';
    }
  }
  
  // Edit property
  async function editProperty(id) {
    try {
      // Get the property data
      const propertyId = id.includes('/') ? id : `properties/${id}`;
      const parts = propertyId.split('/');
      const cleanId = parts.length > 1 ? parts[1] : id;
      
      console.log('Editing property with ID:', cleanId);
      
      // Fetch the property
      const response = await fetch(`/api/properties/${cleanId}`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response from API:', errorText);
        throw new Error(`Failed to fetch property: ${response.statusText}`);
      }
      
      const property = await response.json();
      console.log('Property data:', property);
      
      // Show edit modal
      showEditPropertyModal(property);
    } catch (error) {
      console.error('Error editing property:', error);
      alert(`Error editing property: ${error.message}`);
    }
  }
  
  // Delete property
  async function deleteProperty(id) {
    try {
      if (!id) {
        throw new Error('Missing property ID');
      }
      
      console.log('Original property ID:', id);
      
      // Get the document key regardless of format
      const docKey = id.includes('/')
        ? id.split('/')[1]  // Extract key from properties/12345
        : id.startsWith('properties_')
          ? id.substring(10)  // Extract key from properties_12345
          : id;  // Use as is if it's just the key
      
      console.log('Using document key for delete:', docKey);
      
      // Confirm deletion
      if (!confirm('Are you sure you want to delete this property? This action cannot be undone.')) {
        return;
      }
      
      // Send delete request
      console.log(`Sending DELETE request to /api/properties/${docKey}`);
      const response = await fetch(`/api/properties/${docKey}`, {
        method: 'DELETE'
      });
      
      // Check response
      console.log('Delete response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Delete error response:', errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { error: errorText };
        }
        
        throw new Error(`Delete failed: ${errorData.error || response.statusText}`);
      }
      
      // Parse result
      let result;
      try {
        const resultText = await response.text();
        console.log('Delete result text:', resultText);
        result = resultText ? JSON.parse(resultText) : { success: true };
      } catch (e) {
        console.warn('Error parsing delete result:', e);
        result = { success: true };
      }
      
      console.log('Property deleted:', result);
      
      // Update UI
      alert('Property deleted successfully!');
      
      // Reload properties list
      loadProperties();
    } catch (error) {
      console.error('Error deleting property:', error);
      alert(`Error deleting property: ${error.message}`);
    }
  }
  
  // Delete predictor
  async function deletePredictor(id) {
    try {
      if (!id) {
        throw new Error('Missing predictor ID');
      }
      
      console.log('Original predictor ID:', id);
      
      // Get the document key regardless of format
      const docKey = id.includes('/')
        ? id.split('/')[1]  // Extract key from propertyPredictors/12345
        : id.startsWith('propertyPredictors_')
          ? id.substring(19)  // Extract key from propertyPredictors_12345
          : id;  // Use as is if it's just the key
      
      console.log('Using document key for delete:', docKey);
      
      // Confirm deletion
      if (!confirm('Are you sure you want to delete this predictor? This action cannot be undone.')) {
        return;
      }
      
      // Send delete request
      console.log(`Sending DELETE request to /api/propertyPredictors/${docKey}`);
      const response = await fetch(`/api/propertyPredictors/${docKey}`, {
        method: 'DELETE'
      });
      
      // Check response
      console.log('Delete response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Delete error response:', errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { error: errorText };
        }
        
        throw new Error(`Delete failed: ${errorData.error || response.statusText}`);
      }
      
      // Parse result
      let result;
      try {
        const resultText = await response.text();
        console.log('Delete result text:', resultText);
        result = resultText ? JSON.parse(resultText) : { success: true };
      } catch (e) {
        console.warn('Error parsing delete result:', e);
        result = { success: true };
      }
      
      console.log('Predictor deleted:', result);
      
      // Update UI
      alert('Predictor deleted successfully!');
      
      // Reload predictors list
      loadPredictors();
    } catch (error) {
      console.error('Error deleting predictor:', error);
      alert(`Error deleting predictor: ${error.message}`);
    }
  }
  
  // Apply predictor
  async function applyPredictor(predictorId) {
    try {
      // Get active perspective
      const activePerspective = document.getElementById('active-perspective')?.textContent || 'default';
      
      // Get all entities
      const response = await fetch(`/api/entities?perspective=${activePerspective}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch entities: ${response.statusText}`);
      }
      
      const entities = await response.json();
      if (!entities.length) {
        alert('No entities available. Please create an entity first.');
        return;
      }
      
      // Create a selection list
      const entityOptions = entities.map((entity, index) => 
        `${index + 1}. ${entity.label || entity.name || 'Unnamed'} (${entity.kind})`
      ).join('\n');
      
      // Ask user which entity to update
      const selection = prompt(`Select an entity to apply predictor to (enter number):\n${entityOptions}`);
      if (!selection) return;
      
      const selectedIndex = parseInt(selection) - 1;
      if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= entities.length) {
        alert('Invalid selection');
        return;
      }
      
      const selectedEntity = entities[selectedIndex];
      const entityId = selectedEntity._id || selectedEntity._key;
      
      // Get the document key regardless of format
      const docKey = predictorId.includes('/')
        ? predictorId.split('/')[1]  // Extract key
        : predictorId;  // Use as is if it's just the key
      
      // Apply the predictor
      const applyResponse = await fetch(`/api/propertyPredictors/${docKey}/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          entityId: entityId
        })
      });
      
      if (!applyResponse.ok) {
        const errorData = await applyResponse.json();
        throw new Error(`Failed to apply predictor: ${errorData.error || applyResponse.statusText}`);
      }
      
      const result = await applyResponse.json();
      console.log('Predictor applied:', result);
      
      // Show result
      alert(`Predictor applied successfully!\nResult: ${result.result}\nComputed from: ${JSON.stringify(result.inputValues)}`);
      
      // Dispatch event to update entity
      document.dispatchEvent(new CustomEvent('entityUpdated', {
        detail: { entity: result.entity }
      }));
      
    } catch (error) {
      console.error('Error applying predictor:', error);
      alert(`Error applying predictor: ${error.message}`);
    }
  }
  
  // Show edit property modal
  function showEditPropertyModal(property) {
    // Create a modal backdrop
    const modalBackdrop = document.createElement('div');
    modalBackdrop.classList.add('fixed', 'inset-0', 'bg-black', 'bg-opacity-75', 'flex', 'items-center', 'justify-center', 'z-50');
    modalBackdrop.id = 'edit-property-modal';
    
    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.classList.add('bg-dkGrey', 'p-6', 'rounded-lg', 'w-96', 'max-w-full', 'max-h-screen', 'overflow-y-auto');
    
    // Create form elements
    modalContent.innerHTML = `
      <h2 class="text-white text-xl mb-4">Edit Property</h2>
      <div class="mb-4">
        <label class="block text-lytGrey mb-1">Name</label>
        <input id="edit-property-name" class="w-full input-transparent text-white p-2 border border-lytGrey rounded" value="${property.name || ''}">
      </div>
      <div class="mb-4">
        <label class="block text-lytGrey mb-1">Data Type</label>
        <select id="edit-property-data-type" class="w-full input-transparent text-white p-2 bg-dkGrey border border-lytGrey rounded">
          <option value="number" ${property.dataType === 'number' ? 'selected' : ''}>Number</option>
          <option value="string" ${property.dataType === 'string' ? 'selected' : ''}>String</option>
          <option value="boolean" ${property.dataType === 'boolean' ? 'selected' : ''}>Boolean</option>
          <option value="parameterSpace" ${property.dataType === 'parameterSpace' ? 'selected' : ''}>Parameter Space</option>
          <option value="enum" ${property.dataType === 'enum' ? 'selected' : ''}>Enumeration</option>
        </select>
      </div>
      
      <div id="edit-property-number-fields" class="${(property.dataType === 'number' || property.dataType === 'parameterSpace') ? '' : 'hidden'}">
        <div class="mb-4">
          <label class="block text-lytGrey mb-1">Min Value</label>
          <input id="edit-property-min" type="number" class="w-full input-transparent text-white p-2 border border-lytGrey rounded" value="${property.min || 0}">
        </div>
        <div class="mb-4">
          <label class="block text-lytGrey mb-1">Max Value</label>
          <input id="edit-property-max" type="number" class="w-full input-transparent text-white p-2 border border-lytGrey rounded" value="${property.max || 100}">
        </div>
        <div class="mb-4">
          <label class="block text-lytGrey mb-1">Unit (optional)</label>
          <input id="edit-property-unit" class="w-full input-transparent text-white p-2 border border-lytGrey rounded" value="${property.unit || ''}">
        </div>
        <div class="mb-4 ${property.dataType === 'parameterSpace' ? '' : 'hidden'}">
          <label class="block text-lytGrey mb-1">Distribution</label>
          <select id="edit-property-distribution" class="w-full input-transparent text-white p-2 bg-dkGrey border border-lytGrey rounded">
            <option value="uniform" ${property.distribution === 'uniform' ? 'selected' : ''}>Uniform</option>
            <option value="gaussian" ${property.distribution === 'gaussian' ? 'selected' : ''}>Gaussian</option>
            <option value="exponential" ${property.distribution === 'exponential' ? 'selected' : ''}>Exponential</option>
          </select>
        </div>
        <div class="mb-4 ${property.dataType === 'parameterSpace' ? '' : 'hidden'}">
          <label class="block text-lytGrey mb-1">Mean Value (for non-uniform distributions)</label>
          <input id="edit-property-mean" type="number" class="w-full input-transparent text-white p-2 border border-lytGrey rounded" value="${property.mean || 50}">
        </div>
      </div>
      
      <div id="edit-property-enum-fields" class="${property.dataType === 'enum' ? '' : 'hidden'}">
        <div class="mb-4">
          <label class="block text-lytGrey mb-1">Options (one per line)</label>
          <textarea id="edit-property-options" class="w-full input-transparent text-white p-2 border border-lytGrey rounded" rows="4">${property.options ? property.options.join('\n') : ''}</textarea>
        </div>
      </div>
      
      <div class="mb-4">
        <label class="block text-lytGrey mb-1">Applicable Types</label>
        <div id="edit-property-applicable-types" class="border border-lytGrey rounded p-2 max-h-32 overflow-y-auto">
          <!-- Types will be loaded dynamically -->
        </div>
      </div>
      
      <div class="flex items-center justify-between mt-6">
        <button id="edit-property-cancel" class="px-4 py-2 bg-transparent border border-lytGrey rounded hover:bg-gray-700 text-white">Cancel</button>
        <button id="edit-property-save" class="px-4 py-2 bg-transparent border border-lytGreen rounded hover:bg-lytGreen hover:text-black text-white">Save Changes</button>
      </div>
    `;
    
    // Add modal to the document
    modalBackdrop.appendChild(modalContent);
    document.body.appendChild(modalBackdrop);
    
    // Load applicable types with correct selection
    const applicableTypesContainer = document.getElementById('edit-property-applicable-types');
    if (applicableTypesContainer) {
      // Get types
      const typePromise = types.length > 0 ? Promise.resolve(types) : fetch('/api/types').then(r => r.json());
      
      typePromise.then(availableTypes => {
        applicableTypesContainer.innerHTML = '';
        availableTypes.forEach(type => {
          const isSelected = property.applicableTo && property.applicableTo.includes(type._id || type._key);
          
          const checkbox = document.createElement('div');
          checkbox.classList.add('flex', 'items-center', 'mb-1');
          checkbox.innerHTML = `
            <input type="checkbox" id="edit-prop-type-${type._key}" value="${type._id || type._key}" class="mr-2" ${isSelected ? 'checked' : ''}>
            <label for="edit-prop-type-${type._key}" class="text-white text-sm">${type.name || 'Unnamed Type'}</label>
          `;
          applicableTypesContainer.appendChild(checkbox);
        });
      }).catch(error => {
        console.error('Error loading types for edit modal:', error);
        applicableTypesContainer.innerHTML = '<div class="text-lytRed">Error loading types</div>';
      });
    }
    
    // Show/hide conditional fields based on data type selection
    const editPropertyDataType = document.getElementById('edit-property-data-type');
    const editPropertyNumberFields = document.getElementById('edit-property-number-fields');
    const editPropertyEnumFields = document.getElementById('edit-property-enum-fields');
    
    editPropertyDataType?.addEventListener('change', () => {
      const selectedType = editPropertyDataType.value;
      
      // Hide all conditional fields first
      if (editPropertyNumberFields) editPropertyNumberFields.classList.add('hidden');
      if (editPropertyEnumFields) editPropertyEnumFields.classList.add('hidden');
      
      // Show appropriate fields based on selection
      if (selectedType === 'number' || selectedType === 'parameterSpace') {
        if (editPropertyNumberFields) editPropertyNumberFields.classList.remove('hidden');
      } else if (selectedType === 'enum') {
        if (editPropertyEnumFields) editPropertyEnumFields.classList.remove('hidden');
      }
    });
    
    // Handle cancel button
    document.getElementById('edit-property-cancel')?.addEventListener('click', () => {
      document.body.removeChild(modalBackdrop);
    });
    
    // Handle save button
    document.getElementById('edit-property-save')?.addEventListener('click', async () => {
      try {
        // Get the document key regardless of format
        const docKey = (property._id || property._key || '').includes('/')
          ? (property._id || property._key).split('/')[1]  // Extract key from properties/12345
          : (property._id || property._key || '').startsWith('properties_')
            ? (property._id || property._key).substring(10)  // Extract key from properties_12345
            : (property._id || property._key);  // Use as is if it's just the key
        
        console.log('Using document key for update:', docKey);
        
        // Get updated values
        const updatedName = document.getElementById('edit-property-name').value;
        const updatedDataType = document.getElementById('edit-property-data-type').value;
        
        // Get applicable types
        const applicableTypes = [];
        document.querySelectorAll('#edit-property-applicable-types input[type="checkbox"]:checked').forEach(checkbox => {
          applicableTypes.push(checkbox.value);
        });
        
        // Prepare update data
        const updateData = {
          name: updatedName,
          dataType: updatedDataType,
          applicableTo: applicableTypes
        };
        
        // Add conditional fields based on data type
        if (updatedDataType === 'number' || updatedDataType === 'parameterSpace') {
          updateData.min = parseFloat(document.getElementById('edit-property-min').value);
          updateData.max = parseFloat(document.getElementById('edit-property-max').value);
          updateData.unit = document.getElementById('edit-property-unit').value;
          
          if (updatedDataType === 'parameterSpace') {
            updateData.distribution = document.getElementById('edit-property-distribution').value;
            updateData.mean = parseFloat(document.getElementById('edit-property-mean').value);
          }
        } else if (updatedDataType === 'enum') {
          const optionsText = document.getElementById('edit-property-options').value;
          updateData.options = optionsText.split('\n').filter(line => line.trim() !== '').map(line => line.trim());
        }
        
        console.log(`Sending PATCH request to /api/properties/${docKey} with data:`, updateData);
        
        // Send update request
        const response = await fetch(`/api/properties/${docKey}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updateData)
        });
        
        // Check response
        console.log('Update response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Update error response:', errorText);
          
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch (e) {
            errorData = { error: errorText };
          }
          
          throw new Error(`Update failed: ${errorData.error || response.statusText}`);
        }
        
        // Parse result
        let result;
        try {
          const resultText = await response.text();
          console.log('Update result text:', resultText);
          result = resultText ? JSON.parse(resultText) : { success: true };
        } catch (e) {
          console.warn('Error parsing update result:', e);
          result = { success: true };
        }
        
        console.log('Property updated:', result);
        
        // Close modal and reload properties
        document.body.removeChild(modalBackdrop);
        loadProperties();
        
        alert('Property updated successfully!');
      } catch (error) {
        console.error('Error saving property updates:', error);
        alert(`Error saving property updates: ${error.message}`);
      }
    });
  }
  
  // Handle property form submission
  propertySubmit?.addEventListener('click', async () => {
    try {
      if (!propertyName?.value) {
        alert('Property name is required');
        return;
      }
      
      if (!propertyDataType?.value) {
        alert('Please select a data type');
        return;
      }
      
      // Get applicable types
      const applicableTypes = [];
      document.querySelectorAll('#property-applicable-types input[type="checkbox"]:checked').forEach(checkbox => {
        applicableTypes.push(checkbox.value);
      });
      
      if (applicableTypes.length === 0) {
        alert('Please select at least one applicable type');
        return;
      }
      
      // Create property data
      const propertyData = {
        name: propertyName.value,
        dataType: propertyDataType.value,
        applicableTo: applicableTypes
      };
      
      // Add conditional fields based on data type
      if (propertyData.dataType === 'number' || propertyData.dataType === 'parameterSpace') {
        if (!propertyMin?.value || !propertyMax?.value) {
          alert('Min and max values are required for number properties');
          return;
        }
        
        propertyData.min = parseFloat(propertyMin.value);
        propertyData.max = parseFloat(propertyMax.value);
        propertyData.unit = propertyUnit?.value || '';
        
        if (propertyData.dataType === 'parameterSpace') {
          propertyData.distribution = propertyDistribution?.value || 'uniform';
          propertyData.mean = parseFloat(propertyMean?.value || '50');
        }
      } else if (propertyData.dataType === 'enum') {
        if (!propertyOptions?.value) {
          alert('Options are required for enum properties');
          return;
        }
        
        const optionsText = propertyOptions.value;
        propertyData.options = optionsText.split('\n').filter(line => line.trim() !== '').map(line => line.trim());
        
        if (propertyData.options.length === 0) {
          alert('At least one option is required for enum properties');
          return;
        }
      }
      
      console.log('Creating property:', propertyData);
      
      // Send request
      const response = await fetch('/api/properties', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(propertyData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to create property:', errorData);
        alert(`Failed to create property: ${errorData.error || response.statusText}`);
        return;
      }
      
      const result = await response.json();
      console.log('Property created:', result);
      
      // Clear form
      propertyName.value = '';
      propertyDataType.selectedIndex = 0;
      propertyMin.value = '0';
      propertyMax.value = '100';
      propertyUnit.value = '';
      propertyDistribution.selectedIndex = 0;
      propertyMean.value = '50';
      propertyOptions.value = '';
      
      // Uncheck all applicable types
      document.querySelectorAll('#property-applicable-types input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false;
      });
      
      // Hide conditional fields
      if (propertyNumberFields) propertyNumberFields.classList.add('hidden');
      if (propertyEnumFields) propertyEnumFields.classList.add('hidden');
      
      // Reload properties list
      loadProperties();
      
      alert('Property created successfully!');
    } catch (error) {
      console.error('Error creating property:', error);
      alert(`Error creating property: ${error.message}`);
    }
  });
  
  // Handle predictor form submission
  predictorSubmit?.addEventListener('click', async () => {
    try {
      if (!predictorName?.value) {
        alert('Predictor name is required');
        return;
      }
      
      if (!predictorFormula?.value) {
        alert('Formula is required');
        return;
      }
      
      if (!predictorOutputName?.value) {
        alert('Output name is required');
        return;
      }
      
      // Get input properties
      const inputProperties = [];
      document.querySelectorAll('#predictor-input-properties input[type="checkbox"]:checked').forEach(checkbox => {
        inputProperties.push(checkbox.value);
      });
      
      if (inputProperties.length === 0) {
        alert('Please select at least one input property');
        return;
      }
      
      // Get applicable types
      const applicableTypes = [];
      document.querySelectorAll('#predictor-applicable-types input[type="checkbox"]:checked').forEach(checkbox => {
        applicableTypes.push(checkbox.value);
      });
      
      if (applicableTypes.length === 0) {
        alert('Please select at least one applicable type');
        return;
      }
      
      // Create predictor data
      const predictorData = {
        name: predictorName.value,
        formula: predictorFormula.value,
        inputs: inputProperties,
        output: {
          name: predictorOutputName.value,
          unit: predictorOutputUnit?.value || '',
          dataType: predictorOutputType?.value || 'number'
        },
        applicableTo: applicableTypes,
        confidence: parseFloat(predictorConfidence?.value || '0.5')
      };
      
      console.log('Creating predictor:', predictorData);
      
      // Send request
      const response = await fetch('/api/propertyPredictors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(predictorData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to create predictor:', errorData);
        alert(`Failed to create predictor: ${errorData.error || response.statusText}`);
        return;
      }
      
      const result = await response.json();
      console.log('Predictor created:', result);
      
      // Clear form
      predictorName.value = '';
      predictorFormula.value = '';
      predictorOutputName.value = '';
      predictorOutputUnit.value = '';
      predictorOutputType.selectedIndex = 0;
      predictorConfidence.value = '0.5';
      if (predictorConfidenceValue) predictorConfidenceValue.textContent = '0.5';
      
      // Uncheck all checkboxes
      document.querySelectorAll('#predictor-input-properties input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false;
      });
      
      document.querySelectorAll('#predictor-applicable-types input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false;
      });
      
      // Reload predictors list
      loadPredictors();
      
      alert('Predictor created successfully!');
    } catch (error) {
      console.error('Error creating predictor:', error);
      alert(`Error creating predictor: ${error.message}`);
    }
  });
  
  // Test predictor button
  predictorTest?.addEventListener('click', () => {
    try {
      // Get formula and input values
      const formula = predictorFormula?.value;
      if (!formula) {
        alert('Please enter a formula to test');
        return;
      }
      
      // Create a simple test environment
      const testValues = {
        string_length: 12,
        string_tension: 45,
        material_density: 800,
        bridge_height: 10,
        body_volume: 4.5
      };
      
      // Execute the formula in a safe way
      const keys = Object.keys(testValues);
      const values = Object.values(testValues);
      
      // Display test values
      const testValuesStr = Object.entries(testValues)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
      
      // Create the evaluation function
      try {
        const evalFn = new Function(...keys, `return ${formula};`);
        const result = evalFn(...values);
        
        alert(`Test Results:\n\nInput Values:\n${testValuesStr}\n\nFormula: ${formula}\n\nResult: ${result}`);
      } catch (e) {
        alert(`Error evaluating formula: ${e.message}\n\nMake sure your formula uses these variables: ${keys.join(', ')}`);
      }
    } catch (error) {
      console.error('Error testing predictor:', error);
      alert(`Error testing predictor: ${error.message}`);
    }
  });
  
  // Helper function to get cookie value
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }
});
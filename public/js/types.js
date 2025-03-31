document.addEventListener('DOMContentLoaded', () => {
  // Set up color picker for Type form
  const typeColorPreview = document.getElementById('type-color-preview');
  const typeColorPalette = document.getElementById('type-color-palette');
  const typeColorPicker = document.getElementById('type-color-picker');
  const typeColorHex = document.getElementById('type-color-hex');
  const typeColorValue = document.getElementById('type-color-value');
  const typeSubmitBtn = document.getElementById('type-submit');

  // Initial state
  if (typeColorPreview) {
    typeColorPreview.style.backgroundColor = '#FF9500';
  }

  // Toggle color palette
  if (typeColorPreview && typeColorPalette) {
    typeColorPreview.addEventListener('click', (e) => {
      e.stopPropagation();
      typeColorPalette.classList.toggle('visible');
      
      // Update accordion to make space for palette
      const accordionContent = document.querySelector('.accordion[data-form="type"] .accordion-content');
      if (accordionContent) {
        accordionContent.classList.toggle('has-active-color-picker');
      }
    });
  }

  // Select color from palette
  if (typeColorPalette) {
    const paletteColors = typeColorPalette.querySelectorAll('.palette-color');
    
    paletteColors.forEach(color => {
      color.addEventListener('click', () => {
        const selectedColor = color.getAttribute('data-color');
        
        if (typeColorPreview) {
          typeColorPreview.style.backgroundColor = selectedColor;
        }
        
        if (typeColorHex) {
          typeColorHex.value = selectedColor;
        }
        
        if (typeColorPicker) {
          typeColorPicker.value = selectedColor;
        }
        
        if (typeColorValue) {
          typeColorValue.value = selectedColor.replace('#', '0x');
        }
        
        // Close palette
        typeColorPalette.classList.remove('visible');
        
        // Remove expanded style
        const accordionContent = document.querySelector('.accordion[data-form="type"] .accordion-content');
        if (accordionContent) {
          accordionContent.classList.remove('has-active-color-picker');
        }
      });
    });
  }

  // Update from color picker input
  if (typeColorPicker) {
    typeColorPicker.addEventListener('input', () => {
      const selectedColor = typeColorPicker.value;
      
      if (typeColorPreview) {
        typeColorPreview.style.backgroundColor = selectedColor;
      }
      
      if (typeColorHex) {
        typeColorHex.value = selectedColor;
      }
      
      if (typeColorValue) {
        typeColorValue.value = selectedColor.replace('#', '0x');
      }
    });
  }

  // Update from hex input
  if (typeColorHex) {
    typeColorHex.addEventListener('input', () => {
      let colorValue = typeColorHex.value;
      
      // Add # if needed
      if (colorValue && !colorValue.startsWith('#')) {
        colorValue = '#' + colorValue;
      }
      
      // Only update if valid hex
      if (/^#[0-9A-Fa-f]{6}$/.test(colorValue)) {
        if (typeColorPreview) {
          typeColorPreview.style.backgroundColor = colorValue;
        }
        
        if (typeColorPicker) {
          typeColorPicker.value = colorValue;
        }
        
        if (typeColorValue) {
          typeColorValue.value = colorValue.replace('#', '0x');
        }
      }
    });
  }

  // Handle clicks outside the color picker
  document.addEventListener('click', (e) => {
    if (typeColorPalette && typeColorPalette.classList.contains('visible')) {
      // Check if click is outside the palette and picker
      if (!typeColorPalette.contains(e.target) && e.target !== typeColorPreview) {
        typeColorPalette.classList.remove('visible');
        
        // Remove expanded style
        const accordionContent = document.querySelector('.accordion[data-form="type"] .accordion-content');
        if (accordionContent) {
          accordionContent.classList.remove('has-active-color-picker');
        }
      }
    }
  });

  // Type submission
  if (typeSubmitBtn) {
    typeSubmitBtn.addEventListener('click', async () => {
      const name = document.getElementById('type-name')?.value;
      const color = document.getElementById('type-color-value')?.value;
      const symbol = document.getElementById('type-shape')?.value;
      
      if (!name) {
        alert('Type name is required');
        return;
      }
      
      try {
        const response = await fetch('/api/types', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name,
            color,
            symbol,
            category: 'custom', // Default category
            schema: {}  // Empty schema to start with
          })
        });
        
        const result = await response.json();
        
        if (response.ok) {
          console.log('Type created:', result);
          alert('Type created successfully!');
          
          // Dispatch an event for the visualization to update
          document.dispatchEvent(new CustomEvent('typeCreated', {
            detail: { type: result.type }
          }));
          
          // Clear form
          if (document.getElementById('type-name')) {
            document.getElementById('type-name').value = '';
          }
          if (document.getElementById('type-shape')) {
            document.getElementById('type-shape').value = '';
          }
          
          // Reset color to default
          if (typeColorPreview) {
            typeColorPreview.style.backgroundColor = '#FF9500';
          }
          if (typeColorHex) {
            typeColorHex.value = '#FF9500';
          }
          if (typeColorPicker) {
            typeColorPicker.value = '#FF9500';
          }
          if (typeColorValue) {
            typeColorValue.value = '0xff9500';
          }
          
          // Load types for test operations
          loadTypes();
        } else {
          console.error('Failed to create type:', result);
          alert(`Failed to create type: ${result.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Error creating type:', error);
        alert(`Error creating type: ${error.message}`);
      }
    });
  }
  
  // Handle test update button
  const typeTestUpdate = document.getElementById('type-test-update');
  if (typeTestUpdate) {
    typeTestUpdate.addEventListener('click', async () => {
      try {
        // Get all types to show in a prompt
        const response = await fetch('/api/types');
        if (!response.ok) {
          throw new Error(`Failed to fetch types: ${response.statusText}`);
        }
        
        const types = await response.json();
        if (!types.length) {
          alert('No types available to update. Please create a type first.');
          return;
        }
        
        // Create a selection list
        const typeOptions = types.map((type, index) => 
          `${index + 1}. ${type.name} (${type._key || type._id?.split('/')[1] || 'unknown'})`
        ).join('\n');
        
        // Ask user which type to update
        const selection = prompt(`Select a type to update (enter number):\n${typeOptions}`);
        if (!selection) return;
        
        const selectedIndex = parseInt(selection) - 1;
        if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= types.length) {
          alert('Invalid selection');
          return;
        }
        
        const selectedType = types[selectedIndex];
        
        // Show edit type modal
        showEditTypeModal(selectedType);
      } catch (error) {
        console.error('Error updating type:', error);
        alert(`Error updating type: ${error.message}`);
      }
    });
  }
  
  // Show edit type modal
  function showEditTypeModal(type) {
    // Create a modal backdrop
    const modalBackdrop = document.createElement('div');
    modalBackdrop.classList.add('fixed', 'inset-0', 'bg-black', 'bg-opacity-75', 'flex', 'items-center', 'justify-center', 'z-50');
    modalBackdrop.id = 'edit-type-modal';
    
    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.classList.add('bg-dkGrey', 'p-6', 'rounded-lg', 'w-96', 'max-w-full', 'max-h-screen', 'overflow-y-auto');
    
    // Create form elements
    modalContent.innerHTML = `
      <h2 class="text-white text-xl mb-4">Edit Type</h2>
      <div class="mb-4">
        <label class="block text-lytGrey mb-1">Name</label>
        <input id="edit-type-name" class="w-full input-transparent text-white p-2 border border-lytGrey rounded" value="${type.name || ''}">
      </div>
      <div class="mb-4">
        <label class="block text-lytGrey mb-1">Type ID (read-only)</label>
        <input id="edit-type-id" class="w-full input-transparent text-lytGrey p-2 border border-gray-700 rounded bg-gray-800" value="${type._id || type._key}" readonly>
      </div>
      <div class="mb-4">
        <label class="block text-lytGrey mb-1">Shape</label>
        <select id="edit-type-shape" class="w-full input-transparent text-white p-2 bg-dkGrey border border-lytGrey rounded">
          <option value="sphere" ${type.symbol === 'sphere' ? 'selected' : ''}>Sphere</option>
          <option value="cube" ${type.symbol === 'cube' ? 'selected' : ''}>Cube</option>
          <option value="cylinder" ${type.symbol === 'cylinder' ? 'selected' : ''}>Cylinder</option>
          <option value="cone" ${type.symbol === 'cone' ? 'selected' : ''}>Cone</option>
          <option value="tetrahedron" ${type.symbol === 'tetrahedron' ? 'selected' : ''}>Tetrahedron (Pyramid)</option>
          <option value="octahedron" ${type.symbol === 'octahedron' ? 'selected' : ''}>Octahedron</option>
          <option value="dodecahedron" ${type.symbol === 'dodecahedron' ? 'selected' : ''}>Dodecahedron</option>
          <option value="icosahedron" ${type.symbol === 'icosahedron' ? 'selected' : ''}>Icosahedron</option>
          <option value="torus" ${type.symbol === 'torus' ? 'selected' : ''}>Torus (Ring)</option>
        </select>
      </div>
      <div class="mb-4">
        <label class="block text-lytGrey mb-1">Color</label>
        <div class="flex items-center">
          <div id="edit-type-color-preview" class="w-10 h-10 rounded mr-2 cursor-pointer border border-lytGrey" style="background-color: ${type.color || '#FF9500'}"></div>
          <input id="edit-type-color-picker" type="color" class="hidden" value="${(type.color?.startsWith('#') ? type.color : (type.color?.startsWith('0x') ? '#' + type.color.substring(2) : '#FF9500'))}">
          <input id="edit-type-color-hex" class="input-transparent text-white p-1 placeholder-lytGrey" placeholder="#RRGGBB" value="${(type.color?.startsWith('#') ? type.color : (type.color?.startsWith('0x') ? '#' + type.color.substring(2) : '#FF9500'))}">
          <input id="edit-type-color-value" type="hidden" value="${(type.color?.startsWith('0x') ? type.color : (type.color?.startsWith('#') ? type.color.replace('#', '0x') : '0xff9500'))}">
        </div>
      </div>
      <div class="flex items-center justify-between mt-6">
        <button id="edit-type-cancel" class="px-4 py-2 bg-transparent border border-lytGrey rounded hover:bg-gray-700 text-white">Cancel</button>
        <button id="edit-type-save" class="px-4 py-2 bg-transparent border border-lytGreen rounded hover:bg-lytGreen hover:text-black text-white">Save Changes</button>
      </div>
    `;
    
    // Add modal to the document
    modalBackdrop.appendChild(modalContent);
    document.body.appendChild(modalBackdrop);
    
    // Setup color picker functionality
    const typeColorPreview = document.getElementById('edit-type-color-preview');
    const typeColorPicker = document.getElementById('edit-type-color-picker');
    const typeColorHex = document.getElementById('edit-type-color-hex');
    const typeColorValue = document.getElementById('edit-type-color-value');
    
    // Show color picker when preview is clicked
    if (typeColorPreview && typeColorPicker) {
      typeColorPreview.addEventListener('click', () => {
        typeColorPicker.click();
      });
    }
    
    // Update from color picker input
    if (typeColorPicker) {
      typeColorPicker.addEventListener('input', () => {
        const selectedColor = typeColorPicker.value;
        
        if (typeColorPreview) {
          typeColorPreview.style.backgroundColor = selectedColor;
        }
        
        if (typeColorHex) {
          typeColorHex.value = selectedColor;
        }
        
        if (typeColorValue) {
          typeColorValue.value = selectedColor.replace('#', '0x');
        }
      });
    }
    
    // Update from hex input
    if (typeColorHex) {
      typeColorHex.addEventListener('input', () => {
        let colorValue = typeColorHex.value;
        
        // Add # if needed
        if (colorValue && !colorValue.startsWith('#')) {
          colorValue = '#' + colorValue;
        }
        
        // Only update if valid hex
        if (/^#[0-9A-Fa-f]{6}$/.test(colorValue)) {
          if (typeColorPreview) {
            typeColorPreview.style.backgroundColor = colorValue;
          }
          
          if (typeColorPicker) {
            typeColorPicker.value = colorValue;
          }
          
          if (typeColorValue) {
            typeColorValue.value = colorValue.replace('#', '0x');
          }
        }
      });
    }
    
    // Handle cancel button
    document.getElementById('edit-type-cancel').addEventListener('click', () => {
      document.body.removeChild(modalBackdrop);
    });
    
    // Handle save button
    document.getElementById('edit-type-save').addEventListener('click', async () => {
      try {
        const typeId = type._id || type._key;
        const parts = typeId.includes('/') ? typeId.split('/') : ['types', typeId];
        const cleanId = parts.length > 1 ? parts[1] : typeId;
        
        // Get updated values
        const updatedName = document.getElementById('edit-type-name').value;
        const updatedShape = document.getElementById('edit-type-shape').value;
        const updatedColor = document.getElementById('edit-type-color-value').value;
        
        // Prepare update data
        const updateData = {
          name: updatedName,
          symbol: updatedShape,
          color: updatedColor
        };
        
        // Send update request
        const response = await fetch(`/api/types/${cleanId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updateData)
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Update failed: ${errorData.error || response.statusText}`);
        }
        
        const result = await response.json();
        console.log('Type updated:', result);
        
        // Dispatch event for visualization update
        document.dispatchEvent(new CustomEvent('typeUpdated', {
          detail: { type: result.updated }
        }));
        
        // Close modal
        document.body.removeChild(modalBackdrop);
        
        alert('Type updated successfully!');
      } catch (error) {
        console.error('Error saving type updates:', error);
        alert(`Error saving type updates: ${error.message}`);
      }
    });
  }
  
  // Handle test delete button
  const typeTestDelete = document.getElementById('type-test-delete');
  if (typeTestDelete) {
    typeTestDelete.addEventListener('click', async () => {
      try {
        // Get all types to show in a prompt
        const response = await fetch('/api/types');
        if (!response.ok) {
          throw new Error(`Failed to fetch types: ${response.statusText}`);
        }
        
        const types = await response.json();
        if (!types.length) {
          alert('No types available to delete.');
          return;
        }
        
        // Create a selection list
        const typeOptions = types.map((type, index) => 
          `${index + 1}. ${type.name} (${type._key || (type._id?.split('/')[1] || 'unknown')})`
        ).join('\n');
        
        // Ask user which type to delete
        const selection = prompt(`Select a type to delete (enter number):\n${typeOptions}`);
        if (!selection) return;
        
        const selectedIndex = parseInt(selection) - 1;
        if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= types.length) {
          alert('Invalid selection');
          return;
        }
        
        const selectedType = types[selectedIndex];
        console.log('Selected type for deletion:', selectedType);
        
        // Get the document key regardless of format
        const docKey = (selectedType._id || selectedType._key || '').includes('/')
          ? (selectedType._id || selectedType._key).split('/')[1]  // Extract key from types/12345
          : (selectedType._id || selectedType._key || '').startsWith('types_')
            ? (selectedType._id || selectedType._key).substring(6)  // Extract key from types_12345
            : (selectedType._id || selectedType._key);  // Use as is if it's just the key
        
        console.log('Using document key for delete:', docKey);
        
        // Confirm deletion
        if (!confirm(`Are you sure you want to delete type "${selectedType.name}"? This action cannot be undone.`)) {
          return;
        }
        
        // Make delete request with detailed logging
        console.log(`Sending DELETE request to /api/types/${docKey}`);
        const deleteResponse = await fetch(`/api/types/${docKey}`, {
          method: 'DELETE'
        });
        
        // Check response
        console.log('Delete response status:', deleteResponse.status);
        
        if (!deleteResponse.ok) {
          const errorText = await deleteResponse.text();
          console.error('Delete error response:', errorText);
          
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch (e) {
            errorData = { error: errorText };
          }
          
          throw new Error(`Delete failed: ${errorData.error || deleteResponse.statusText}`);
        }
        
        // Parse result
        let result;
        try {
          const resultText = await deleteResponse.text();
          console.log('Delete result text:', resultText);
          result = resultText ? JSON.parse(resultText) : { success: true };
        } catch (e) {
          console.warn('Error parsing delete result:', e);
          result = { success: true };
        }
        
        console.log('Type deleted:', result);
        alert(`Type "${selectedType.name}" deleted successfully!`);
        
        // Dispatch event for visualization update
        document.dispatchEvent(new CustomEvent('typeDeleted', {
          detail: { typeId: selectedType._id || selectedType._key }
        }));
        
        // Reload types 
        loadTypes();
        
      } catch (error) {
        console.error('Error deleting type:', error);
        alert(`Error deleting type: ${error.message}`);
      }
    });
  }
  
  // Load available types
  async function loadTypes() {
    try {
      const response = await fetch('/api/types');
      if (!response.ok) {
        throw new Error(`Failed to fetch types: ${response.statusText}`);
      }
      
      const types = await response.json();
      console.log(`Loaded ${types.length} types for test operations`);
      
    } catch (error) {
      console.error('Error loading types:', error);
    }
  }
  
  // Types list container
  const typesList = document.getElementById('types-list');
  
  // Display types in the list
  async function displayTypes(types) {
    if (!typesList) return;
    
    // Clear the current list
    typesList.innerHTML = '';
    
    if (types.length === 0) {
      typesList.innerHTML = '<div class="text-lytGrey italic">No types found. Create one!</div>';
      return;
    }
    
    // Add each type to the list
    types.forEach(type => {
      const typeElement = document.createElement('div');
      typeElement.classList.add('type-item', 'flex', 'items-center', 'justify-between', 'py-1', 'text-sm', 'border-b', 'border-dkGrey');
      typeElement.dataset.id = type._id || type._key;
      
      // Main info
      const nameSpan = document.createElement('span');
      nameSpan.classList.add('type-name', 'flex-grow', 'flex', 'items-center');
      
      // Color indicator
      const colorIndicator = document.createElement('span');
      colorIndicator.classList.add('w-3', 'h-3', 'rounded-full', 'mr-2');
      colorIndicator.style.backgroundColor = type.color || '#ff9500';
      
      nameSpan.appendChild(colorIndicator);
      nameSpan.innerHTML += `<span class="font-bold">${type.name || 'Unnamed Type'}</span>`;
      
      // Controls container
      const controls = document.createElement('div');
      controls.classList.add('type-controls', 'flex', 'items-center');
      
      // Edit button with wider spacing
      const editBtn = document.createElement('button');
      editBtn.innerHTML = '<svg class="icon w-5 h-5" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>';
      editBtn.title = 'Edit Type';
      editBtn.classList.add('text-white', 'hover:text-lytOrange', 'mr-3'); // Increased margin
      editBtn.addEventListener('click', () => showEditTypeModal(type));
      
      // Delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.innerHTML = '<svg class="icon w-4 h-4" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>';
      deleteBtn.title = 'Delete Type';
      deleteBtn.classList.add('text-white', 'hover:text-lytRed');
      deleteBtn.addEventListener('click', () => {
        deleteType(type._id || type._key);
      });
      
      // Assemble the controls
      controls.appendChild(editBtn);
      controls.appendChild(deleteBtn);
      
      // Assemble the type item
      typeElement.appendChild(nameSpan);
      typeElement.appendChild(controls);
      
      // Add to list
      typesList.appendChild(typeElement);
    });
  }
  
  // Delete type function
  async function deleteType(id) {
    try {
      if (!id) {
        throw new Error('Missing type ID');
      }
      
      console.log('Original type ID:', id);
      
      // Get the document key regardless of format
      const docKey = id.includes('/')
        ? id.split('/')[1]  // Extract key from types/12345
        : id.startsWith('types_')
          ? id.substring(6)  // Extract key from types_12345
          : id;  // Use as is if it's just the key
      
      console.log('Using document key for delete:', docKey);
      
      // Confirm deletion
      if (!confirm('Are you sure you want to delete this type? This action cannot be undone.')) {
        return;
      }
      
      // Send delete request
      console.log(`Sending DELETE request to /api/types/${docKey}`);
      const response = await fetch(`/api/types/${docKey}`, {
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
      
      console.log('Type deleted:', result);
      
      // Update UI
      alert('Type deleted successfully!');
      
      // Dispatch event for visualization update
      document.dispatchEvent(new CustomEvent('typeDeleted', {
        detail: { typeId: id }
      }));
      
      // Reload types list
      loadTypes();
    } catch (error) {
      console.error('Error deleting type:', error);
      alert(`Error deleting type: ${error.message}`);
    }
  }
  
  // Load available types and update the list
  async function loadTypes() {
    try {
      const response = await fetch('/api/types');
      if (!response.ok) {
        throw new Error(`Failed to fetch types: ${response.statusText}`);
      }
      
      const types = await response.json();
      console.log(`Loaded ${types.length} types`);
      
      // Display types in the list
      displayTypes(types);
      
      return types;
    } catch (error) {
      console.error('Error loading types:', error);
      if (typesList) {
        typesList.innerHTML = '<div class="text-lytRed">Error loading types: ' + error.message + '</div>';
      }
      return [];
    }
  }
  
  // Initial load of types
  loadTypes();
  
  // Listen for type changes
  document.addEventListener('typeCreated', () => {
    console.log('Type created, reloading list');
    loadTypes();
  });
  
  document.addEventListener('typeUpdated', () => {
    console.log('Type updated, reloading list');
    loadTypes();
  });
});
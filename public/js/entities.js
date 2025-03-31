document.addEventListener('DOMContentLoaded', () => {
  // Entity form elements
  const entityForm = document.getElementById('entity-form');
  const entityName = document.getElementById('entity-name');
  const entityType = document.getElementById('entity-type');
  const entityKind = document.getElementById('entity-kind');
  const entitySubmit = document.getElementById('entity-submit');
  const entityDebug = document.getElementById('entity-debug');
  const entitiesList = document.getElementById('entities-list');
  
  // Initial load
  loadEntities();
  
  // Fill type selection with available types
  async function loadTypes() {
    if (!entityType) return;
    
    try {
      const response = await fetch('/api/types');
      if (!response.ok) {
        console.error('Failed to fetch types:', response.statusText);
        return;
      }
      
      const types = await response.json();
      
      // Clear existing options (keep the default one)
      entityType.innerHTML = '<option value="" disabled selected>Select a Type</option>';
      
      // Add types to dropdown
      types.forEach(type => {
        const option = document.createElement('option');
        option.value = type._id || type._key;
        option.textContent = type.name;
        entityType.appendChild(option);
      });
    } catch (error) {
      console.error('Error loading types:', error);
    }
  }
  
  // Load entities and populate list
  async function loadEntities() {
    if (!entitiesList) return;
    
    try {
      // Get active perspective
      const activePerspective = document.getElementById('active-perspective')?.textContent || 'default';
      
      // Load types first to show type names
      let typeMap = {};
      try {
        const typesResponse = await fetch('/api/types');
        if (typesResponse.ok) {
          const types = await typesResponse.json();
          types.forEach(type => {
            typeMap[type._id || `types/${type._key}`] = type.name || 'Unnamed Type';
          });
        }
      } catch (err) {
        console.warn('Error loading types for entity list:', err);
      }
      
      console.log('Type mapping:', typeMap);
      
      // Fetch entities for this perspective
      const response = await fetch(`/api/entities?perspective=${activePerspective}`);
      if (!response.ok) {
        console.error('Failed to fetch entities:', response.statusText);
        entitiesList.innerHTML = '<div class="text-lytRed">Error loading entities</div>';
        return;
      }
      
      const entities = await response.json();
      console.log('Loaded entities:', entities);
      
      // Clear current list
      entitiesList.innerHTML = '';
      
      if (entities.length === 0) {
        entitiesList.innerHTML = '<div class="text-lytGrey italic">No entities found. Create one!</div>';
        return;
      }
      
      // Add each entity to the list
      entities.forEach(entity => {
        const entityElement = document.createElement('div');
        entityElement.classList.add('entity-item', 'flex', 'items-center', 'justify-between', 'py-1', 'text-sm', 'border-b', 'border-dkGrey');
        entityElement.dataset.id = entity._id || entity._key;
        
        // Get the type name if possible
        const typeName = entity.type ? (typeMap[entity.type] || 'Unknown Type') : 'No Type';
        
        // Main info
        const nameSpan = document.createElement('span');
        nameSpan.classList.add('entity-name', 'flex-grow');
        
        // Determine the correct display name
        const displayName = entity.label || entity.name || 'Unnamed Entity';
        nameSpan.innerHTML = `<span class="font-bold">${displayName}</span> <span class="text-lytGrey text-xs">(${typeName})</span>`;
        
        // Entity kind tag
        const kindTag = document.createElement('span');
        kindTag.classList.add('entity-kind', 'px-1', 'mr-2', 'text-xs', 'rounded');
        kindTag.textContent = entity.kind;
        
        // Set color based on kind
        switch(entity.kind) {
          case 'object':
            kindTag.classList.add('bg-lytBlue', 'text-black');
            break;
          case 'agent':
            kindTag.classList.add('bg-lytGreen', 'text-black');
            break;
          case 'material':
            kindTag.classList.add('bg-lytOrange', 'text-black');
            break;
          case 'environment':
            kindTag.classList.add('bg-lytPurple', 'text-black');
            break;
          case 'interaction':
            kindTag.classList.add('bg-lytRed', 'text-black');
            break;
          default:
            kindTag.classList.add('bg-lytGrey', 'text-black');
        }
        
        // Controls container
        const controls = document.createElement('div');
        controls.classList.add('entity-controls', 'flex', 'items-center');
        
        // Edit button with increased size and margin
        const editBtn = document.createElement('button');
        editBtn.innerHTML = '<svg class="icon w-5 h-5" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>';
        editBtn.title = 'Edit Entity';
        editBtn.classList.add('text-white', 'hover:text-lytOrange', 'mr-3'); // Increased margin
        editBtn.addEventListener('click', () => editEntity(entity._id || entity._key, entityElement));
        
        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<svg class="icon w-4 h-4" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>';
        deleteBtn.title = 'Delete Entity';
        deleteBtn.classList.add('text-white', 'hover:text-lytRed');
        deleteBtn.addEventListener('click', () => deleteEntity(entity._id || entity._key));
        
        // Assemble the controls
        controls.appendChild(kindTag);
        controls.appendChild(editBtn);
        controls.appendChild(deleteBtn);
        
        // Assemble the entity item
        entityElement.appendChild(nameSpan);
        entityElement.appendChild(controls);
        
        // Add to list
        entitiesList.appendChild(entityElement);
      });
      
      console.log(`Loaded ${entities.length} entities`);
    } catch (error) {
      console.error('Error loading entities:', error);
      entitiesList.innerHTML = '<div class="text-lytRed">Error loading entities: ' + error.message + '</div>';
    }
  }
  
  // Edit entity - now supports inline editing
  async function editEntity(id, entityElement = null) {
    try {
      // Get the entity data
      const entityId = id.includes('/') ? id : `entities/${id}`;
      const parts = entityId.split('/');
      const cleanId = parts.length > 1 ? parts[1] : id;
      
      console.log('Editing entity with ID:', cleanId);
      
      // Fetch the entity
      const response = await fetch(`/api/entities/${cleanId}`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response from API:', errorText);
        throw new Error(`Failed to fetch entity: ${response.statusText}`);
      }
      
      const entity = await response.json();
      console.log('Entity data:', entity);
      
      if (entityElement) {
        // Use inline editing when entity element is provided
        showInlineEntityEditor(entity, entityElement);
      } else {
        // Use modal editing as fallback
        showEditEntityModal(entity);
      }
    } catch (error) {
      console.error('Error editing entity:', error);
      alert(`Error editing entity: ${error.message}`);
    }
  }
  
  // Show inline entity editor
  async function showInlineEntityEditor(entity, entityElement) {
    try {
      // Save the original content to restore if cancelled
      const originalContent = entityElement.innerHTML;
      
      // Get types for dropdown
      const typesResponse = await fetch('/api/types');
      const types = await typesResponse.json();
      
      // Create type options
      const typeOptions = types.map(type => 
        `<option value="${type._id || type._key}" ${entity.type === (type._id || `types/${type._key}`) ? 'selected' : ''}>${type.name || 'Unnamed Type'}</option>`
      ).join('');
      
      // Replace the entity element content with an inline form
      entityElement.innerHTML = `
        <div class="inline-editor p-2 bg-dkGrey rounded w-full">
          <div class="mb-2">
            <input id="inline-entity-name" class="w-full input-transparent text-white p-1 border border-lytGrey rounded" 
              value="${entity.label || entity.name || ''}" placeholder="Entity name">
          </div>
          <div class="mb-2 flex gap-2">
            <select id="inline-entity-type" class="input-transparent text-white p-1 bg-dkGrey border border-lytGrey rounded flex-grow">
              <option value="" disabled>Select Type</option>
              ${typeOptions}
            </select>
            <select id="inline-entity-kind" class="input-transparent text-white p-1 bg-dkGrey border border-lytGrey rounded">
              <option value="object" ${entity.kind === 'object' ? 'selected' : ''}>Object</option>
              <option value="agent" ${entity.kind === 'agent' ? 'selected' : ''}>Agent</option>
              <option value="material" ${entity.kind === 'material' ? 'selected' : ''}>Material</option>
              <option value="environment" ${entity.kind === 'environment' ? 'selected' : ''}>Environment</option>
              <option value="interaction" ${entity.kind === 'interaction' ? 'selected' : ''}>Interaction</option>
            </select>
          </div>
          <div class="flex justify-between">
            <button id="inline-entity-cancel" class="px-2 py-1 text-xs bg-transparent border border-lytGrey rounded hover:bg-gray-700 text-white">Cancel</button>
            <button id="inline-entity-save" class="px-2 py-1 text-xs bg-transparent border border-lytGreen rounded hover:bg-lytGreen hover:text-black text-white">Save</button>
          </div>
        </div>
      `;
      
      // Add event listeners
      document.getElementById('inline-entity-cancel').addEventListener('click', () => {
        // Restore original content
        entityElement.innerHTML = originalContent;
      });
      
      document.getElementById('inline-entity-save').addEventListener('click', async () => {
        try {
          // Get updated values
          const updatedName = document.getElementById('inline-entity-name').value;
          const updatedKind = document.getElementById('inline-entity-kind').value;
          const updatedType = document.getElementById('inline-entity-type').value;
          
          // Get the document key regardless of format
          const docKey = (entity._id || entity._key || '').includes('/')
            ? (entity._id || entity._key).split('/')[1]  // Extract key from entities/12345
            : (entity._id || entity._key || '').startsWith('entities_')
              ? (entity._id || entity._key).substring(9)  // Extract key from entities_12345
              : (entity._id || entity._key);  // Use as is if it's just the key
          
          console.log('Using document key for update:', docKey);
          
          // Prepare update data
          const updateData = {
            label: updatedName,
            kind: updatedKind,
            type: updatedType
          };
          
          console.log(`Sending PATCH request to /api/entities/${docKey} with data:`, updateData);
          
          // Send update request
          const response = await fetch(`/api/entities/${docKey}`, {
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
          
          console.log('Entity updated:', result);
          
          // Dispatch event for visualization update
          document.dispatchEvent(new CustomEvent('entityUpdated', {
            detail: { entity: result.updated || updateData }
          }));
          
          // Reload entities to update the list
          loadEntities();
        } catch (error) {
          console.error('Error saving entity updates:', error);
          alert(`Error saving entity updates: ${error.message}`);
          // Restore original content on error
          entityElement.innerHTML = originalContent;
        }
      });
      
    } catch (error) {
      console.error('Error showing inline editor:', error);
      alert(`Error: ${error.message}`);
    }
  }
  
  // Delete entity
  async function deleteEntity(id) {
    try {
      if (!id) {
        throw new Error('Missing entity ID');
      }
      
      console.log('Original entity ID:', id);
      
      // Get the document key regardless of format
      const docKey = id.includes('/')
        ? id.split('/')[1]  // Extract key from entities/12345
        : id.startsWith('entities_')
          ? id.substring(9)  // Extract key from entities_12345
          : id;  // Use as is if it's just the key
      
      console.log('Using document key for delete:', docKey);
      
      // Confirm deletion
      if (!confirm('Are you sure you want to delete this entity? This action cannot be undone.')) {
        return;
      }
      
      // Send delete request - Try with just the key
      console.log(`Sending DELETE request to /api/entities/${docKey}`);
      const response = await fetch(`/api/entities/${docKey}`, {
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
      
      console.log('Entity deleted:', result);
      
      // Update UI
      alert('Entity deleted successfully!');
      
      // Dispatch event for visualization to update
      document.dispatchEvent(new CustomEvent('entityDeleted', {
        detail: { entityId: id }
      }));
      
      // Reload entities list
      loadEntities();
    } catch (error) {
      console.error('Error deleting entity:', error);
      alert(`Error deleting entity: ${error.message}`);
    }
  }
  
  // Show edit entity modal
  function showEditEntityModal(entity) {
    // Create a modal backdrop
    const modalBackdrop = document.createElement('div');
    modalBackdrop.classList.add('fixed', 'inset-0', 'bg-black', 'bg-opacity-75', 'flex', 'items-center', 'justify-center', 'z-50');
    modalBackdrop.id = 'edit-entity-modal';
    
    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.classList.add('bg-dkGrey', 'p-6', 'rounded-lg', 'w-96', 'max-w-full', 'max-h-screen', 'overflow-y-auto');
    
    // Create form elements
    modalContent.innerHTML = `
      <h2 class="text-white text-xl mb-4">Edit Entity</h2>
      <div class="mb-4">
        <label class="block text-lytGrey mb-1">Name</label>
        <input id="edit-entity-name" class="w-full input-transparent text-white p-2 border border-lytGrey rounded" value="${entity.label || ''}">
      </div>
      <div class="mb-4">
        <label class="block text-lytGrey mb-1">Kind</label>
        <select id="edit-entity-kind" class="w-full input-transparent text-white p-2 bg-dkGrey border border-lytGrey rounded">
          <option value="object" ${entity.kind === 'object' ? 'selected' : ''}>Object</option>
          <option value="agent" ${entity.kind === 'agent' ? 'selected' : ''}>Agent</option>
          <option value="material" ${entity.kind === 'material' ? 'selected' : ''}>Material</option>
          <option value="environment" ${entity.kind === 'environment' ? 'selected' : ''}>Environment</option>
          <option value="interaction" ${entity.kind === 'interaction' ? 'selected' : ''}>Interaction</option>
        </select>
      </div>
      <div class="mb-4">
        <label class="block text-lytGrey mb-1">Entity ID (read-only)</label>
        <input id="edit-entity-id" class="w-full input-transparent text-lytGrey p-2 border border-gray-700 rounded bg-gray-800" value="${entity._id || entity._key}" readonly>
      </div>
      <div class="mb-4">
        <label class="block text-lytGrey mb-1">Type</label>
        <select id="edit-entity-type" class="w-full input-transparent text-white p-2 bg-dkGrey border border-lytGrey rounded">
          <!-- Types will be loaded dynamically -->
        </select>
      </div>
      <div class="flex items-center justify-between mt-6">
        <button id="edit-entity-cancel" class="px-4 py-2 bg-transparent border border-lytGrey rounded hover:bg-gray-700 text-white">Cancel</button>
        <button id="edit-entity-save" class="px-4 py-2 bg-transparent border border-lytGreen rounded hover:bg-lytGreen hover:text-black text-white">Save Changes</button>
      </div>
    `;
    
    // Add modal to the document
    modalBackdrop.appendChild(modalContent);
    document.body.appendChild(modalBackdrop);
    
    // Load types for the dropdown
    const typeSelect = document.getElementById('edit-entity-type');
    fetch('/api/types')
      .then(response => response.json())
      .then(types => {
        types.forEach(type => {
          const option = document.createElement('option');
          option.value = type._id || type._key;
          option.textContent = type.name || 'Unnamed Type';
          option.selected = (entity.type === type._id || entity.type === type._key);
          typeSelect.appendChild(option);
        });
      })
      .catch(error => console.error('Error loading types for edit modal:', error));
    
    // Handle cancel button
    document.getElementById('edit-entity-cancel').addEventListener('click', () => {
      document.body.removeChild(modalBackdrop);
    });
    
    // Handle save button
    document.getElementById('edit-entity-save').addEventListener('click', async () => {
      try {
        // Get and log entity ID in all possible formats
        console.log('Entity object:', entity);
        
        // Get the document key regardless of format
        const docKey = (entity._id || entity._key || '').includes('/')
          ? (entity._id || entity._key).split('/')[1]  // Extract key from entities/12345
          : (entity._id || entity._key || '').startsWith('entities_')
            ? (entity._id || entity._key).substring(9)  // Extract key from entities_12345
            : (entity._id || entity._key);  // Use as is if it's just the key
        
        console.log('Using document key for update:', docKey);
        
        // Get updated values
        const updatedName = document.getElementById('edit-entity-name').value;
        const updatedKind = document.getElementById('edit-entity-kind').value;
        const updatedType = document.getElementById('edit-entity-type').value;
        
        // Prepare update data
        const updateData = {
          label: updatedName,
          kind: updatedKind,
          type: updatedType
        };
        
        console.log(`Sending PATCH request to /api/entities/${docKey} with data:`, updateData);
        
        // Send update request
        const response = await fetch(`/api/entities/${docKey}`, {
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
        
        console.log('Entity updated:', result);
        
        // Dispatch event for visualization update
        document.dispatchEvent(new CustomEvent('entityUpdated', {
          detail: { entity: result.updated || updateData }
        }));
        
        // Close modal and reload entities
        document.body.removeChild(modalBackdrop);
        loadEntities();
        
        alert('Entity updated successfully!');
      } catch (error) {
        console.error('Error saving entity updates:', error);
        alert(`Error saving entity updates: ${error.message}`);
      }
    });
  }
  
  // Load types when the form becomes visible
  if (entityForm) {
    const accordionItem = document.querySelector('[data-form="entity-form"]');
    if (accordionItem) {
      accordionItem.addEventListener('click', () => {
        // Load types when the form is shown
        loadTypes();
      });
    }
  }
  
  // Handle entity creation
  if (entitySubmit) {
    entitySubmit.addEventListener('click', async () => {
      if (!entityName?.value) {
        alert('Entity name is required');
        return;
      }
      
      if (!entityType?.value) {
        alert('Please select a type for the entity');
        return;
      }
      
      if (!entityKind?.value) {
        alert('Please select a kind for the entity');
        return;
      }
      
      // Get user ID from cookie or storage
      const userId = getCookie('userId') || localStorage.getItem('userId') || 'anonymous';
      
      // Get current perspective
      const activePerspective = document.getElementById('active-perspective')?.textContent || 'default';
      
      // Create entity data
      const entityData = {
        name: entityName.value,
        typeId: entityType.value,
        kind: entityKind.value,
        creatorId: userId,
        perspective: activePerspective,
        props: {} // Empty props to start with
      };
      
      try {
        const response = await fetch('/api/entities', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(entityData)
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error('Failed to create entity:', errorData);
          alert(`Failed to create entity: ${errorData.error || response.statusText}`);
          return;
        }
        
        const result = await response.json();
        console.log('Entity created:', result);
        
        // Dispatch an event for the visualization to update
        document.dispatchEvent(new CustomEvent('entityCreated', {
          detail: { entity: result.entity }
        }));
        
        // Clear form
        entityName.value = '';
        entityType.selectedIndex = 0;
        entityKind.selectedIndex = 0;
        
        // Reload entities list
        loadEntities();
        
        alert('Entity created successfully!');
      } catch (error) {
        console.error('Error creating entity:', error);
        alert(`Error creating entity: ${error.message}`);
      }
    });
  }
  
  // Debug button
  if (entityDebug) {
    entityDebug.addEventListener('click', async () => {
      try {
        const response = await fetch('/api/debug');
        const data = await response.json();
        console.log('Debug data:', data);
        alert('Debug information logged to console');
      } catch (error) {
        console.error('Error fetching debug data:', error);
        alert(`Error fetching debug data: ${error.message}`);
      }
    });
  }
  
  // Entity test update button
  const entityTestUpdate = document.getElementById('entity-test-update');
  if (entityTestUpdate) {
    entityTestUpdate.addEventListener('click', async () => {
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
          alert('No entities available to update. Please create an entity first.');
          return;
        }
        
        // Create a selection list
        const entityOptions = entities.map((entity, index) => 
          `${index + 1}. ${entity.label || entity.name || 'Unnamed'} (${entity.kind})`
        ).join('\n');
        
        // Ask user which entity to update
        const selection = prompt(`Select an entity to update (enter number):\n${entityOptions}`);
        if (!selection) return;
        
        const selectedIndex = parseInt(selection) - 1;
        if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= entities.length) {
          alert('Invalid selection');
          return;
        }
        
        const selectedEntity = entities[selectedIndex];
        const entityId = selectedEntity._id || selectedEntity._key;
        
        // Get new name
        const newName = prompt('Enter new name for the entity:', selectedEntity.label || selectedEntity.name || '');
        if (!newName) return;
        
        // Make update request
        const updateResponse = await fetch(`/api/entities/${entityId.includes('/') ? entityId.split('/')[1] : entityId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            label: newName
          })
        });
        
        if (!updateResponse.ok) {
          const errorData = await updateResponse.json();
          throw new Error(`Update failed: ${errorData.error || updateResponse.statusText}`);
        }
        
        const result = await updateResponse.json();
        console.log('Entity updated:', result);
        alert(`Entity updated successfully! Entity is now named "${newName}"`);
        
        // Reload entities list
        loadEntities();
        
        // Dispatch event for visualization update
        document.dispatchEvent(new CustomEvent('entityUpdated', {
          detail: { entity: result.updated }
        }));
        
      } catch (error) {
        console.error('Error updating entity:', error);
        alert(`Error updating entity: ${error.message}`);
      }
    });
  }
  
  // Entity test delete button
  const entityTestDelete = document.getElementById('entity-test-delete');
  if (entityTestDelete) {
    entityTestDelete.addEventListener('click', async () => {
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
          alert('No entities available to delete.');
          return;
        }
        
        // Create a selection list
        const entityOptions = entities.map((entity, index) => 
          `${index + 1}. ${entity.label || entity.name || 'Unnamed'} (${entity.kind})`
        ).join('\n');
        
        // Ask user which entity to delete
        const selection = prompt(`Select an entity to delete (enter number):\n${entityOptions}`);
        if (!selection) return;
        
        const selectedIndex = parseInt(selection) - 1;
        if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= entities.length) {
          alert('Invalid selection');
          return;
        }
        
        const selectedEntity = entities[selectedIndex];
        const entityId = selectedEntity._id || selectedEntity._key;
        const entityName = selectedEntity.label || selectedEntity.name || 'Unnamed';
        
        // Confirm deletion
        if (!confirm(`Are you sure you want to delete entity "${entityName}"? This action cannot be undone.`)) {
          return;
        }
        
        // Make delete request
        const deleteResponse = await fetch(`/api/entities/${entityId.includes('/') ? entityId.split('/')[1] : entityId}`, {
          method: 'DELETE'
        });
        
        if (!deleteResponse.ok) {
          const errorData = await deleteResponse.json();
          throw new Error(`Delete failed: ${errorData.error || deleteResponse.statusText}`);
        }
        
        const result = await deleteResponse.json();
        console.log('Entity deleted:', result);
        alert(`Entity "${entityName}" deleted successfully!`);
        
        // Reload entities list
        loadEntities();
        
        // Dispatch event for visualization update
        document.dispatchEvent(new CustomEvent('entityDeleted', {
          detail: { entityId: entityId }
        }));
        
      } catch (error) {
        console.error('Error deleting entity:', error);
        alert(`Error deleting entity: ${error.message}`);
      }
    });
  }
  
  // Listen for perspective changes
  document.addEventListener('perspectiveChanged', (event) => {
    console.log('Perspective changed, reloading entities');
    loadEntities();
  });
  
  // Helper function to get cookie value
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }
});
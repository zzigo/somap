document.addEventListener('DOMContentLoaded', () => {
  // Relation form elements
  const relationForm = document.getElementById('relation-form');
  const relationName = document.getElementById('relation-name');
  const relationFrom = document.getElementById('relation-from');
  const relationTo = document.getElementById('relation-to');
  const relationLineType = document.getElementById('relation-linetype');
  const relationSubmit = document.getElementById('relation-submit');
  const relationDebug = document.getElementById('relation-debug');
  
  // Initial setup
  loadEntities();
  
  // Load entities for dropdowns
  async function loadEntities() {
    if (!relationFrom || !relationTo) return;
    
    try {
      // Get active perspective
      const activePerspective = document.getElementById('active-perspective')?.textContent || 'default';
      
      const response = await fetch(`/api/entities?perspective=${activePerspective}`);
      if (!response.ok) {
        console.error('Failed to fetch entities:', response.statusText);
        return;
      }
      
      const entities = await response.json();
      
      // Clear existing options (keep the default ones)
      relationFrom.innerHTML = '<option value="" disabled selected>Select Source Entity</option>';
      relationTo.innerHTML = '<option value="" disabled selected>Select Target Entity</option>';
      
      // Add entities to dropdowns
      entities.forEach(entity => {
        const option1 = document.createElement('option');
        option1.value = entity._id || `entities/${entity._key}`;
        option1.textContent = `${entity.label || entity.name || 'Unnamed'} (${entity.kind})`;
        relationFrom.appendChild(option1);
        
        const option2 = document.createElement('option');
        option2.value = entity._id || `entities/${entity._key}`;
        option2.textContent = `${entity.label || entity.name || 'Unnamed'} (${entity.kind})`;
        relationTo.appendChild(option2);
      });
    } catch (error) {
      console.error('Error loading entities for relation form:', error);
    }
  }
  
  // Handle form submission
  if (relationSubmit) {
    relationSubmit.addEventListener('click', async () => {
      if (!relationName?.value) {
        alert('Relation name is required');
        return;
      }
      
      if (!relationFrom?.value) {
        alert('Please select a source entity');
        return;
      }
      
      if (!relationTo?.value) {
        alert('Please select a target entity');
        return;
      }
      
      const relationData = {
        name: relationName.value,
        from: relationFrom.value,
        to: relationTo.value,
        lineType: relationLineType?.value || 'solid',
        predicate: relationName.value // Use name as predicate by default
      };
      
      try {
        const response = await fetch('/api/relations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(relationData)
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error('Failed to create relation:', errorData);
          alert(`Failed to create relation: ${errorData.error || response.statusText}`);
          return;
        }
        
        const result = await response.json();
        console.log('Relation created:', result);
        
        // Dispatch event for visualization to update
        document.dispatchEvent(new CustomEvent('relationCreated', {
          detail: { relation: result.relation }
        }));
        
        // Clear form
        relationName.value = '';
        relationFrom.selectedIndex = 0;
        relationTo.selectedIndex = 0;
        if (relationLineType) relationLineType.selectedIndex = 0;
        
        alert('Relation created successfully!');
      } catch (error) {
        console.error('Error creating relation:', error);
        alert(`Error creating relation: ${error.message}`);
      }
    });
  }
  
  // Debug button
  if (relationDebug) {
    relationDebug.addEventListener('click', async () => {
      try {
        const response = await fetch('/api/relations');
        const relations = await response.json();
        console.log('All Relations:', relations);
        alert(`Found ${relations.length} relations. Details logged to console.`);
      } catch (error) {
        console.error('Error fetching relations:', error);
        alert(`Error fetching relations: ${error.message}`);
      }
    });
  }
  
  // Relation test update button
  const relationTestUpdate = document.getElementById('relation-test-update');
  if (relationTestUpdate) {
    relationTestUpdate.addEventListener('click', async () => {
      try {
        // Get all relations
        const response = await fetch('/api/relations');
        if (!response.ok) {
          throw new Error(`Failed to fetch relations: ${response.statusText}`);
        }
        
        const relations = await response.json();
        if (!relations.length) {
          alert('No relations available to update. Please create a relation first.');
          return;
        }
        
        // Create a selection list
        const relationOptions = relations.map((relation, index) => {
          const from = relation._from ? relation._from.split('/')[1] : 'unknown';
          const to = relation._to ? relation._to.split('/')[1] : 'unknown';
          return `${index + 1}. ${relation.name || relation.predicate || 'Unnamed'} (${from} → ${to})`;
        }).join('\n');
        
        // Ask user which relation to update
        const selection = prompt(`Select a relation to update (enter number):\n${relationOptions}`);
        if (!selection) return;
        
        const selectedIndex = parseInt(selection) - 1;
        if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= relations.length) {
          alert('Invalid selection');
          return;
        }
        
        const selectedRelation = relations[selectedIndex];
        
        // Show edit relation modal
        showEditRelationModal(selectedRelation);
      } catch (error) {
        console.error('Error updating relation:', error);
        alert(`Error updating relation: ${error.message}`);
      }
    });
  }
  
  // Show edit relation modal
  async function showEditRelationModal(relation) {
    try {
      // Get entities for dropdowns
      const activePerspective = document.getElementById('active-perspective')?.textContent || 'default';
      const entitiesResponse = await fetch(`/api/entities?perspective=${activePerspective}`);
      if (!entitiesResponse.ok) {
        throw new Error(`Failed to fetch entities: ${entitiesResponse.statusText}`);
      }
      const entities = await entitiesResponse.json();
      
      // Create a modal backdrop
      const modalBackdrop = document.createElement('div');
      modalBackdrop.classList.add('fixed', 'inset-0', 'bg-black', 'bg-opacity-75', 'flex', 'items-center', 'justify-center', 'z-50');
      modalBackdrop.id = 'edit-relation-modal';
      
      // Create modal content
      const modalContent = document.createElement('div');
      modalContent.classList.add('bg-dkGrey', 'p-6', 'rounded-lg', 'w-96', 'max-w-full', 'max-h-screen', 'overflow-y-auto');
      
      // Create entities options
      const entityOptions = entities.map(entity => 
        `<option value="${entity._id || entity._key}" ${relation._from === (entity._id || `entities/${entity._key}`) ? 'selected' : ''}>${entity.label || entity.name || 'Unnamed'} (${entity.kind})</option>`
      ).join('');
      
      const targetEntityOptions = entities.map(entity => 
        `<option value="${entity._id || entity._key}" ${relation._to === (entity._id || `entities/${entity._key}`) ? 'selected' : ''}>${entity.label || entity.name || 'Unnamed'} (${entity.kind})</option>`
      ).join('');
      
      // Create form elements
      modalContent.innerHTML = `
        <h2 class="text-white text-xl mb-4">Edit Relation</h2>
        <div class="mb-4">
          <label class="block text-lytGrey mb-1">Name</label>
          <input id="edit-relation-name" class="w-full input-transparent text-white p-2 border border-lytGrey rounded" value="${relation.name || relation.predicate || ''}">
        </div>
        <div class="mb-4">
          <label class="block text-lytGrey mb-1">Relation ID (read-only)</label>
          <input id="edit-relation-id" class="w-full input-transparent text-lytGrey p-2 border border-gray-700 rounded bg-gray-800" value="${relation._id || relation._key}" readonly>
        </div>
        <div class="mb-4">
          <label class="block text-lytGrey mb-1">Source Entity (From)</label>
          <select id="edit-relation-from" class="w-full input-transparent text-white p-2 bg-dkGrey border border-lytGrey rounded">
            <option value="" disabled>Select Source Entity</option>
            ${entityOptions}
          </select>
        </div>
        <div class="mb-4">
          <label class="block text-lytGrey mb-1">Target Entity (To)</label>
          <select id="edit-relation-to" class="w-full input-transparent text-white p-2 bg-dkGrey border border-lytGrey rounded">
            <option value="" disabled>Select Target Entity</option>
            ${targetEntityOptions}
          </select>
        </div>
        <div class="mb-4">
          <label class="block text-lytGrey mb-1">Line Type</label>
          <select id="edit-relation-linetype" class="w-full input-transparent text-white p-2 bg-dkGrey border border-lytGrey rounded">
            <option value="solid" ${relation.lineType === 'solid' || !relation.lineType ? 'selected' : ''}>Solid</option>
            <option value="dashed" ${relation.lineType === 'dashed' ? 'selected' : ''}>Dashed</option>
            <option value="dotted" ${relation.lineType === 'dotted' ? 'selected' : ''}>Dotted</option>
            <option value="curved" ${relation.lineType === 'curved' ? 'selected' : ''}>Curved</option>
            <option value="thick" ${relation.lineType === 'thick' ? 'selected' : ''}>Thick</option>
          </select>
        </div>
        <div class="flex items-center justify-between mt-6">
          <button id="edit-relation-cancel" class="px-4 py-2 bg-transparent border border-lytGrey rounded hover:bg-gray-700 text-white">Cancel</button>
          <button id="edit-relation-save" class="px-4 py-2 bg-transparent border border-lytGreen rounded hover:bg-lytGreen hover:text-black text-white">Save Changes</button>
        </div>
      `;
      
      // Add modal to the document
      modalBackdrop.appendChild(modalContent);
      document.body.appendChild(modalBackdrop);
      
      // Handle cancel button
      document.getElementById('edit-relation-cancel').addEventListener('click', () => {
        document.body.removeChild(modalBackdrop);
      });
      
      // Handle save button
      document.getElementById('edit-relation-save').addEventListener('click', async () => {
        try {
          const relationId = relation._id || relation._key;
          const parts = relationId.includes('/') ? relationId.split('/') : ['relations', relationId];
          const cleanId = parts.length > 1 ? parts[1] : relationId;
          
          // Get updated values
          const updatedName = document.getElementById('edit-relation-name').value;
          const updatedFrom = document.getElementById('edit-relation-from').value;
          const updatedTo = document.getElementById('edit-relation-to').value;
          const updatedLineType = document.getElementById('edit-relation-linetype').value;
          
          // Format source and target IDs
          const formattedFrom = updatedFrom.includes('/') ? updatedFrom : `entities/${updatedFrom}`;
          const formattedTo = updatedTo.includes('/') ? updatedTo : `entities/${updatedTo}`;
          
          // Prepare update data
          const updateData = {
            name: updatedName,
            predicate: updatedName,
            _from: formattedFrom,
            _to: formattedTo,
            lineType: updatedLineType
          };
          
          // Send update request
          const response = await fetch(`/api/relations/${cleanId}`, {
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
          console.log('Relation updated:', result);
          
          // Dispatch event for visualization update
          document.dispatchEvent(new CustomEvent('relationUpdated', {
            detail: { relation: result.updated }
          }));
          
          // Close modal
          document.body.removeChild(modalBackdrop);
          
          alert('Relation updated successfully!');
        } catch (error) {
          console.error('Error saving relation updates:', error);
          alert(`Error saving relation updates: ${error.message}`);
        }
      });
    } catch (error) {
      console.error('Error showing relation edit modal:', error);
      alert(`Error: ${error.message}`);
    }
  }
  
  // Relation test delete button
  const relationTestDelete = document.getElementById('relation-test-delete');
  if (relationTestDelete) {
    relationTestDelete.addEventListener('click', async () => {
      try {
        // Get all relations
        const response = await fetch('/api/relations');
        if (!response.ok) {
          throw new Error(`Failed to fetch relations: ${response.statusText}`);
        }
        
        const relations = await response.json();
        if (!relations.length) {
          alert('No relations available to delete.');
          return;
        }
        
        // Create a selection list
        const relationOptions = relations.map((relation, index) => {
          const from = relation._from ? relation._from.split('/')[1] : 'unknown';
          const to = relation._to ? relation._to.split('/')[1] : 'unknown';
          return `${index + 1}. ${relation.name || relation.predicate || 'Unnamed'} (${from} → ${to})`;
        }).join('\n');
        
        // Ask user which relation to delete
        const selection = prompt(`Select a relation to delete (enter number):\n${relationOptions}`);
        if (!selection) return;
        
        const selectedIndex = parseInt(selection) - 1;
        if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= relations.length) {
          alert('Invalid selection');
          return;
        }
        
        const selectedRelation = relations[selectedIndex];
        console.log('Relation selected for deletion:', selectedRelation);
        
        // Get the document key regardless of format
        const docKey = (selectedRelation._id || selectedRelation._key || '').includes('/')
          ? (selectedRelation._id || selectedRelation._key).split('/')[1]  // Extract key from relations/12345
          : (selectedRelation._id || selectedRelation._key || '').startsWith('relations_')
            ? (selectedRelation._id || selectedRelation._key).substring(10)  // Extract key from relations_12345
            : (selectedRelation._id || selectedRelation._key);  // Use as is if it's just the key
        
        console.log('Using document key for delete:', docKey);
        
        const relationName = selectedRelation.name || selectedRelation.predicate || 'Unnamed';
        
        // Confirm deletion
        if (!confirm(`Are you sure you want to delete relation "${relationName}"? This action cannot be undone.`)) {
          return;
        }
        
        // Make delete request with detailed logging
        console.log(`Sending DELETE request to /api/relations/${docKey}`);
        const deleteResponse = await fetch(`/api/relations/${docKey}`, {
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
        
        console.log('Relation deleted:', result);
        alert(`Relation "${relationName}" deleted successfully!`);
        
        // Dispatch event for visualization update
        document.dispatchEvent(new CustomEvent('relationDeleted', {
          detail: { relationId: selectedRelation._id || selectedRelation._key }
        }));
        
      } catch (error) {
        console.error('Error deleting relation:', error);
        alert(`Error deleting relation: ${error.message}`);
      }
    });
  }
  
  // Listen for perspective changes
  document.addEventListener('perspectiveChanged', (event) => {
    console.log('Perspective changed, reloading entities for relation dropdown');
    loadEntities();
    loadRelations(); // Also reload the relations list
  });
  
  // Relations list container
  const relationsList = document.getElementById('relations-list');
  
  // Load and display relations
  async function loadRelations() {
    if (!relationsList) return;
    
    try {
      const response = await fetch('/api/relations');
      if (!response.ok) {
        console.error('Failed to fetch relations:', response.statusText);
        relationsList.innerHTML = '<div class="text-lytRed">Error loading relations</div>';
        return;
      }
      
      const relations = await response.json();
      console.log(`Loaded ${relations.length} relations for display`);
      
      // Clear current list
      relationsList.innerHTML = '';
      
      if (relations.length === 0) {
        relationsList.innerHTML = '<div class="text-lytGrey italic">No relations found. Create one!</div>';
        return;
      }
      
      // Fetch entities to get names
      const entitiesResponse = await fetch('/api/entities');
      const entities = entitiesResponse.ok ? await entitiesResponse.json() : [];
      
      // Create a lookup for entity names
      const entityNames = {};
      entities.forEach(entity => {
        entityNames[entity._id] = entity.label || entity.name || 'Unnamed';
      });
      
      // Add each relation to the list
      relations.forEach(relation => {
        const relationElement = document.createElement('div');
        relationElement.classList.add('relation-item', 'flex', 'items-center', 'justify-between', 'py-1', 'text-sm', 'border-b', 'border-dkGrey');
        relationElement.dataset.id = relation._id || relation._key;
        
        // Main info
        const nameSpan = document.createElement('span');
        nameSpan.classList.add('relation-name', 'flex-grow');
        
        // Get source and target entity names
        const fromId = relation._from;
        const toId = relation._to;
        
        const fromName = entityNames[fromId] || fromId.split('/')[1] || 'Unknown';
        const toName = entityNames[toId] || toId.split('/')[1] || 'Unknown';
        
        nameSpan.innerHTML = `
          <span class="font-bold">${relation.name || relation.predicate || 'Unnamed'}</span> 
          <span class="text-lytGrey text-xs ml-2">${fromName} → ${toName}</span>
        `;
        
        // Controls container
        const controls = document.createElement('div');
        controls.classList.add('relation-controls', 'flex', 'items-center');
        
        // Edit button with wider spacing
        const editBtn = document.createElement('button');
        editBtn.innerHTML = '<svg class="icon w-5 h-5" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>';
        editBtn.title = 'Edit Relation';
        editBtn.classList.add('text-white', 'hover:text-lytOrange', 'mr-3'); // Increased margin
        editBtn.addEventListener('click', () => showEditRelationModal(relation));
        
        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<svg class="icon w-4 h-4" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>';
        deleteBtn.title = 'Delete Relation';
        deleteBtn.classList.add('text-white', 'hover:text-lytRed');
        deleteBtn.addEventListener('click', () => deleteRelation(relation._id || relation._key));
        
        // Assemble the controls
        controls.appendChild(editBtn);
        controls.appendChild(deleteBtn);
        
        // Assemble the relation item
        relationElement.appendChild(nameSpan);
        relationElement.appendChild(controls);
        
        // Add to list
        relationsList.appendChild(relationElement);
      });
    } catch (error) {
      console.error('Error loading relations:', error);
      relationsList.innerHTML = '<div class="text-lytRed">Error loading relations: ' + error.message + '</div>';
    }
  }
  
  // Delete relation function
  async function deleteRelation(id) {
    try {
      if (!id) {
        throw new Error('Missing relation ID');
      }
      
      console.log('Original relation ID:', id);
      
      // Get the document key regardless of format
      const docKey = id.includes('/')
        ? id.split('/')[1]  // Extract key from relations/12345
        : id.startsWith('relations_')
          ? id.substring(10)  // Extract key from relations_12345
          : id;  // Use as is if it's just the key
      
      console.log('Using document key for delete:', docKey);
      
      // Confirm deletion
      if (!confirm('Are you sure you want to delete this relation? This action cannot be undone.')) {
        return;
      }
      
      // Send delete request
      console.log(`Sending DELETE request to /api/relations/${docKey}`);
      const response = await fetch(`/api/relations/${docKey}`, {
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
      
      console.log('Relation deleted:', result);
      
      // Update UI
      alert('Relation deleted successfully!');
      
      // Dispatch event for visualization update
      document.dispatchEvent(new CustomEvent('relationDeleted', {
        detail: { relationId: id }
      }));
      
      // Reload relations list
      loadRelations();
    } catch (error) {
      console.error('Error deleting relation:', error);
      alert(`Error deleting relation: ${error.message}`);
    }
  }
  
  // Initial load
  loadRelations();
  
  // Listen for relation changes
  document.addEventListener('relationCreated', () => {
    console.log('Relation created, reloading list');
    loadRelations();
  });
  
  document.addEventListener('relationUpdated', () => {
    console.log('Relation updated, reloading list');
    loadRelations();
  });
});
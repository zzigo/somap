document.addEventListener('DOMContentLoaded', () => {
  // Perspective form elements
  const perspectiveForm = document.getElementById('perspective-form');
  const perspectiveName = document.getElementById('perspective-name');
  const perspectiveDescription = document.getElementById('perspective-description');
  const kindsCheckboxes = document.getElementById('kinds-checkboxes');
  const perspectiveSubmit = document.getElementById('perspective-submit');
  const perspectivesList = document.getElementById('perspectives-list');
  
  // State
  let perspectives = [];
  let activePerspective = 'default';
  
  // Load perspectives on startup
  loadPerspectives();
  
  // Event listeners
  document.querySelector('[data-form="perspective-form"]').addEventListener('click', () => {
    toggleFormVisibility('perspective-form');
  });
  
  if (perspectiveSubmit) {
    perspectiveSubmit.addEventListener('click', createPerspective);
  }
  
  // Functions
  function loadPerspectives() {
    fetch('/api/perspectives')
      .then(response => response.json())
      .then(data => {
        // Make sure we have an array
        if (data && Array.isArray(data)) {
          perspectives = data;
        } else if (data && typeof data === 'object') {
          perspectives = [data]; // Convert single object to array
        } else {
          perspectives = []; // Default to empty array
          console.warn('Unexpected perspectives data format:', data);
        }
        
        renderPerspectivesList();
        
        // Also update active perspective display
        const activeDisplay = document.getElementById('active-perspective');
        if (activeDisplay) {
          activeDisplay.textContent = activePerspective;
        }
      })
      .catch(error => {
        console.error('Error loading perspectives:', error);
        perspectives = []; // Set to empty array on error
        renderPerspectivesList(); // Still try to render what we have
      });
  }
  
  function renderPerspectivesList() {
    if (!perspectivesList) return;
    
    perspectivesList.innerHTML = '';
    
    perspectives.forEach(perspective => {
      const item = document.createElement('div');
      item.classList.add('flex', 'items-center', 'justify-between', 'py-1', 'text-sm');
      
      // Perspective name with active indicator
      const nameSpan = document.createElement('span');
      nameSpan.classList.add('cursor-pointer', 'hover:text-lytOrange');
      if (perspective.name === activePerspective) {
        nameSpan.classList.add('text-lytOrange');
      }
      nameSpan.textContent = perspective.name;
      nameSpan.title = perspective.description || 'Switch to this perspective';
      nameSpan.addEventListener('click', () => switchPerspective(perspective.name));
      
      // Controls container
      const controls = document.createElement('div');
      controls.classList.add('flex', 'gap-2');
      
      // Only show edit/delete for non-default perspective
      if (perspective.name !== 'default') {
        // Edit button
        const editBtn = document.createElement('button');
        editBtn.innerHTML = '<svg class="icon w-4 h-4" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>';
        editBtn.title = 'Edit Perspective';
        editBtn.classList.add('text-white', 'hover:text-lytOrange');
        editBtn.addEventListener('click', () => editPerspective(perspective._key));
        
        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<svg class="icon w-4 h-4" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>';
        deleteBtn.title = 'Delete Perspective';
        deleteBtn.classList.add('text-white', 'hover:text-lytRed');
        deleteBtn.addEventListener('click', () => deletePerspective(perspective._key));
        
        controls.appendChild(editBtn);
        controls.appendChild(deleteBtn);
      }
      
      item.appendChild(nameSpan);
      item.appendChild(controls);
      perspectivesList.appendChild(item);
    });
  }
  
  function createPerspective() {
    // Get kinds from input
    const perspectiveKinds = document.getElementById('perspective-kinds');
    const kindsValue = perspectiveKinds ? perspectiveKinds.value : '';
    const selectedKinds = kindsValue.split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0);
    
    if (!perspectiveName.value) {
      alert('Please enter a perspective name');
      return;
    }
    
    if (selectedKinds.length === 0) {
      alert('Please enter at least one kind');
      return;
    }
    
    const newPerspective = {
      name: perspectiveName.value,
      description: perspectiveDescription.value,
      kinds: selectedKinds,
      relKinds: ['connectedTo', 'builtBy', 'resonatesIn', 'partOf', 'subTypeOf', 'inCategory'],
      origin: 'user-created'
    };
    
    fetch('/api/perspectives', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPerspective)
    })
      .then(response => {
        if (!response.ok) {
          return response.json().then(err => { throw new Error(err.error || 'Failed to create perspective'); });
        }
        return response.json();
      })
      .then(data => {
        // Reset form
        perspectiveName.value = '';
        perspectiveDescription.value = '';
        document.querySelectorAll('#kinds-checkboxes input[type="checkbox"]').forEach(cb => cb.checked = true);
        
        // Hide form
        toggleFormVisibility('perspective-form');
        
        // Reload perspectives
        loadPerspectives();
        
        console.log('Perspective created:', data);
      })
      .catch(error => {
        console.error('Error creating perspective:', error);
        alert(`Failed to create perspective: ${error.message}`);
      });
  }
  
  function editPerspective(key) {
    const perspective = perspectives.find(p => p._key === key);
    if (!perspective) return;
    
    // Populate form
    perspectiveName.value = perspective.name;
    perspectiveDescription.value = perspective.description || '';
    
    // Set kinds input
    const perspectiveKinds = document.getElementById('perspective-kinds');
    if (perspectiveKinds && perspective.kinds) {
      perspectiveKinds.value = perspective.kinds.join(',');
    }
    
    // Show form
    toggleFormVisibility('perspective-form');
    
    // Change submit button to update
    perspectiveSubmit.textContent = 'Update Perspective';
    perspectiveSubmit.dataset.mode = 'edit';
    perspectiveSubmit.dataset.key = key;
    
    // Update event listener
    perspectiveSubmit.removeEventListener('click', createPerspective);
    perspectiveSubmit.addEventListener('click', () => updatePerspective(key));
  }
  
  function updatePerspective(key) {
    // Get kinds from input
    const perspectiveKinds = document.getElementById('perspective-kinds');
    const kindsValue = perspectiveKinds ? perspectiveKinds.value : '';
    const selectedKinds = kindsValue.split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0);
    
    if (!perspectiveName.value) {
      alert('Please enter a perspective name');
      return;
    }
    
    if (selectedKinds.length === 0) {
      alert('Please enter at least one kind');
      return;
    }
    
    const updatedPerspective = {
      name: perspectiveName.value,
      description: perspectiveDescription.value,
      kinds: selectedKinds
    };
    
    fetch(`/api/perspectives/${key}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedPerspective)
    })
      .then(response => {
        if (!response.ok) {
          return response.json().then(err => { throw new Error(err.error || 'Failed to update perspective'); });
        }
        return response.json();
      })
      .then(data => {
        // Reset form
        perspectiveName.value = '';
        perspectiveDescription.value = '';
        document.querySelectorAll('#kinds-checkboxes input[type="checkbox"]').forEach(cb => cb.checked = true);
        
        // Reset button
        perspectiveSubmit.textContent = 'Add Perspective';
        perspectiveSubmit.dataset.mode = 'create';
        delete perspectiveSubmit.dataset.key;
        
        // Reset event listener
        perspectiveSubmit.removeEventListener('click', () => updatePerspective(key));
        perspectiveSubmit.addEventListener('click', createPerspective);
        
        // Hide form
        toggleFormVisibility('perspective-form');
        
        // Reload perspectives
        loadPerspectives();
        
        console.log('Perspective updated:', data);
      })
      .catch(error => {
        console.error('Error updating perspective:', error);
        alert(`Failed to update perspective: ${error.message}`);
      });
  }
  
  function deletePerspective(key) {
    if (!confirm('Are you sure you want to delete this perspective? This will not delete any entities, but they might become inaccessible.')) {
      return;
    }
    
    fetch(`/api/perspectives/${key}`, {
      method: 'DELETE'
    })
      .then(response => {
        if (!response.ok) {
          return response.json().then(err => { throw new Error(err.error || 'Failed to delete perspective'); });
        }
        return response.json();
      })
      .then(data => {
        // Reload perspectives
        loadPerspectives();
        
        console.log('Perspective deleted:', data);
      })
      .catch(error => {
        console.error('Error deleting perspective:', error);
        alert(`Failed to delete perspective: ${error.message}`);
      });
  }
  
  function switchPerspective(name) {
    // Update active perspective
    activePerspective = name;
    
    // Update URL parameter
    const url = new URL(window.location);
    url.searchParams.set('perspective', name);
    window.history.pushState({}, '', url);
    
    // Update display
    const activeDisplay = document.getElementById('active-perspective');
    if (activeDisplay) {
      activeDisplay.textContent = name;
    }
    
    // Reload data
    if (typeof loadEntities === 'function') {
      loadEntities();
    }
    
    // Update perspective list to show active indicator
    renderPerspectivesList();
    
    // Dispatch event for visualization to update
    document.dispatchEvent(new CustomEvent('perspectiveChanged', {
      detail: { perspective: name }
    }));
    
    console.log('Switched to perspective:', name);
  }
  
  // Utility functions
  function toggleFormVisibility(formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    
    // Hide all other forms
    document.querySelectorAll('.form-container').forEach(el => {
      if (el.id !== formId) {
        el.classList.add('hidden');
      }
    });
    
    // Toggle this form
    form.classList.toggle('hidden');
  }
  
  // Initialize by checking URL parameters
  function checkUrlParameters() {
    const url = new URL(window.location);
    const perspective = url.searchParams.get('perspective');
    
    if (perspective) {
      activePerspective = perspective;
      
      // Update display
      const activeDisplay = document.getElementById('active-perspective');
      if (activeDisplay) {
        activeDisplay.textContent = perspective;
      }
    }
  }
  
  // Clear any existing perspective menu
  function clearExistingPerspectiveMenus() {
    // Look for any non-add-perspective menu items
    const menuItems = document.querySelectorAll('.perspective-menu-item');
    menuItems.forEach(item => item.remove());
  }
  
  // Set up perspective dropdown in the header
  function setupPerspectiveDropdown() {
    const dropdown = document.getElementById('perspective-dropdown');
    const dropdownMenu = document.getElementById('perspective-dropdown-menu');
    const dropdownItems = document.getElementById('perspective-dropdown-items');
    const createPerspectiveBtn = document.getElementById('create-perspective-btn');
    
    if (!dropdown || !dropdownMenu || !dropdownItems || !createPerspectiveBtn) return;
    
    // Toggle dropdown on click
    dropdown.addEventListener('click', () => {
      dropdownMenu.classList.toggle('hidden');
      
      // Populate dropdown items
      populatePerspectiveDropdown();
    });
    
    // Hide dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target)) {
        dropdownMenu.classList.add('hidden');
      }
    });
    
    // Create perspective button opens the form
    createPerspectiveBtn.addEventListener('click', () => {
      // Show the perspective form in the sidebar
      const form = document.getElementById('perspective-form');
      if (form) {
        form.classList.remove('hidden');
        
        // Make sure accordion is visible
        const accordions = document.querySelectorAll('.accordion');
        if (accordions.length > 0) {
          const perspectiveAccordion = document.querySelector('.accordion[data-form="perspective"]');
          if (perspectiveAccordion) {
            perspectiveAccordion.style.display = 'block';
          }
        }
      }
      
      // Hide dropdown menu
      dropdownMenu.classList.add('hidden');
    });
  }
  
  // Populate perspective dropdown
  function populatePerspectiveDropdown() {
    const dropdownItems = document.getElementById('perspective-dropdown-items');
    if (!dropdownItems) return;
    
    // Clear current items
    dropdownItems.innerHTML = '';
    
    // Add all perspectives
    perspectives.forEach(perspective => {
      const item = document.createElement('div');
      item.classList.add('flex', 'items-center', 'justify-between', 'p-2', 'hover:bg-gray-800', 'cursor-pointer');
      
      if (perspective.name === activePerspective) {
        item.classList.add('bg-gray-800');
      }
      
      item.innerHTML = `
        <span>${perspective.name}</span>
        <span class="text-xs text-gray-400">${perspective.kinds ? perspective.kinds.length : 0} kinds</span>
      `;
      
      item.addEventListener('click', () => {
        switchPerspective(perspective.name);
      });
      
      dropdownItems.appendChild(item);
    });
  }
  
  // Run initialization
  checkUrlParameters();
  setupPerspectiveDropdown();
  
  // Make sure we're using the first accordion for perspectives (which we moved to the top)
  const allAccordions = document.querySelectorAll('.accordion');
  const perspectiveAccordion = document.querySelector('.accordion[data-form="perspective"]');
  
  if (perspectiveAccordion) {
    // Make sure it's marked as a perspective in a way the UI can identify
    perspectiveAccordion.classList.add('perspective-main');
    
    // Make this one stand out a bit
    const icon = perspectiveAccordion.querySelector('.icon');
    if (icon) {
      icon.style.stroke = '#ff9500'; // Orange color
    }
    
    // Also show current perspective in the status bar
    const statusPerspective = document.getElementById('active-perspective');
    if (statusPerspective) {
      statusPerspective.style.fontWeight = 'bold';
      statusPerspective.style.color = '#ff9500';
    }
  }
  
  // Hide any other perspective accordion that might have been created before
  for (let i = 1; i < allAccordions.length; i++) {
    const accordion = allAccordions[i];
    if (accordion.matches('[data-form="perspective"]') && accordion !== perspectiveAccordion) {
      // Hide duplicate perspective accordions
      accordion.style.display = 'none';
    }
  }
});
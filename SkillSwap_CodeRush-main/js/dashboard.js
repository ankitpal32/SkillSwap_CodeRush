// Dashboard logic: demo localStorage-backed users/skills/requests
(function(){
	const STORAGE_USERS = 'ss_users_v1';
	const STORAGE_REQUESTS = 'ss_requests_v1';
	const STORAGE_CURRENT = 'ss_current_v1';

	function uid(prefix='id'){
		return prefix + '_' + Math.random().toString(36).slice(2,9);
	}

	function read(key){
		try{ return JSON.parse(localStorage.getItem(key)) || []; }catch(e){return []}
	}
	function write(key, val){ localStorage.setItem(key, JSON.stringify(val)); }

	function seedIfEmpty(){
		const users = read(STORAGE_USERS);
		if(users.length===0){
			const sample = [
				{id:uid('u'),name:'Alice Teacher',role:'teacher',skills:['JavaScript','React','HTML']},
				{id:uid('u'),name:'Bob Mentor',role:'teacher',skills:['Photoshop','Illustrator']},
				{id:uid('u'),name:'Carol Tutor',role:'teacher',skills:['Python','Data Science']},
				{id:uid('u'),name:'Dave Student',role:'student',skills:[]}
			];
			write(STORAGE_USERS, sample);
		}
	}

	// Student page: search
	function onStudentPage(){ return !!document.getElementById('skill-search'); }
	function onTeacherPage(){ return !!document.getElementById('requests-list'); }

	function renderCurrentUser(){
		const current = JSON.parse(localStorage.getItem(STORAGE_CURRENT) || 'null');
		const el = document.getElementById('current-user') || document.getElementById('teacher-user');
		if(el){
			el.textContent = current ? `${current.name} (${current.role})` : 'Not signed in';
		}
	}

	function renderSearchResults(term){
		const resultsEl = document.getElementById('results');
		if(!resultsEl) return;
		const users = read(STORAGE_USERS).filter(u=>u.role==='teacher');
		const q = term.trim().toLowerCase();
		const filtered = q ? users.filter(u=>u.skills.join(',').toLowerCase().includes(q)) : users;
		resultsEl.innerHTML = filtered.map(u=>{
			const skills = u.skills.join(', ');
			return `<div class="card"><strong>${u.name}</strong><div>Skills: ${skills || '—'}</div><div style="margin-top:8px"><button class="btn" data-action="request" data-to="${u.id}">Request</button></div></div>`;
		}).join('') || '<p>No teachers found.</p>';
		// wire buttons
		resultsEl.querySelectorAll('button[data-action="request"]').forEach(btn=>{
			btn.addEventListener('click',(e)=>{
				const to = btn.dataset.to;
				sendRequest(to, document.getElementById('skill-search').value || 'General');
			});
		});
	}

	function sendRequest(toId, skill){
		const current = JSON.parse(localStorage.getItem(STORAGE_CURRENT) || 'null');
		if(!current){ alert('Please sign in first (demo sign-in).'); return; }
		const users = read(STORAGE_USERS);
		const to = users.find(u=>u.id===toId);
		if(!to){ alert('Teacher not found'); return; }
		const requests = read(STORAGE_REQUESTS);
		const r = {id:uid('r'),from:current.id,fromName:current.name,to:toId,toName:to.name,skill:skill,status:'pending',created:Date.now()};
		requests.push(r); write(STORAGE_REQUESTS, requests);
		alert('Request sent to ' + to.name);
		// If on teacher page, re-render
		renderRequests();
	}

	function renderRequests(){
		const el = document.getElementById('requests-list');
		if(!el) return;
		const current = JSON.parse(localStorage.getItem(STORAGE_CURRENT) || 'null');
		const requests = read(STORAGE_REQUESTS);
		// teacher sees requests addressed to them
		const my = current && current.role==='teacher' ? requests.filter(r=>r.to===current.id) : requests;
		el.innerHTML = my.map(r=>{
			return `<div class="card"><div><strong>${r.fromName}</strong> requested <em>${r.skill}</em></div><div>Status: ${r.status}</div><div style="margin-top:8px">${r.status==='pending'?`<button class="btn" data-action="accept" data-id="${r.id}">Accept</button>`:''}</div></div>`;
		}).join('') || '<p>No requests.</p>';
		el.querySelectorAll('button[data-action="accept"]').forEach(btn=>{
			btn.addEventListener('click',()=>{ acceptRequest(btn.dataset.id); });
		});
	}

	function acceptRequest(id){
		const requests = read(STORAGE_REQUESTS);
		const idx = requests.findIndex(r=>r.id===id);
		if(idx===-1) return alert('Request not found');
		requests[idx].status = 'accepted';
		write(STORAGE_REQUESTS, requests);
		renderRequests();
		alert('Request accepted');
	}

	function renderSkills(){
		const el = document.getElementById('skills-list');
		if(!el) return;
		const current = JSON.parse(localStorage.getItem(STORAGE_CURRENT) || 'null');
		if(!current) return el.innerHTML = '<p>Sign in as a teacher to manage skills.</p>';
		const users = read(STORAGE_USERS);
		const me = users.find(u=>u.id===current.id) || {skills:[]};
		el.innerHTML = me.skills.map((s,i)=>`<div class="card">${s} <button class="btn danger" data-action="remove" data-i="${i}">Remove</button></div>`).join('') || '<p>No skills yet.</p>';
		el.querySelectorAll('button[data-action="remove"]').forEach(btn=>{
			btn.addEventListener('click',()=>{ removeSkill(parseInt(btn.dataset.i,10)); });
		});
	}

	function removeSkill(index){
		const current = JSON.parse(localStorage.getItem(STORAGE_CURRENT) || 'null');
		if(!current) return alert('Sign in');
		const users = read(STORAGE_USERS);
		const me = users.find(u=>u.id===current.id);
		if(!me) return alert('Profile not found');
		me.skills.splice(index,1);
		write(STORAGE_USERS, users);
		renderSkills();
	}

	function addSkill(name){
		const current = JSON.parse(localStorage.getItem(STORAGE_CURRENT) || 'null');
		if(!current) return alert('Sign in');
		const users = read(STORAGE_USERS);
		const me = users.find(u=>u.id===current.id);
		if(!me) return alert('Profile not found');
		me.skills = me.skills || [];
		me.skills.push(name);
		write(STORAGE_USERS, users);
		renderSkills();
	}

	// Sign-in demo handler
	function handleSignin(evt){
		evt.preventDefault();
		const name = (document.getElementById('signin-name')||{}).value;
		const role = (document.getElementById('signin-role')||{}).value;
		if(!name) return alert('Enter name');
		const users = read(STORAGE_USERS);
		let me = users.find(u=>u.name.toLowerCase()===name.toLowerCase());
		if(!me){ me = {id:uid('u'),name:name,role:role,skills: role==='teacher'?[]:[]}; users.push(me); write(STORAGE_USERS, users); }
		// store current
		localStorage.setItem(STORAGE_CURRENT, JSON.stringify({id:me.id,name:me.name,role:me.role}));
		renderCurrentUser();
		renderRequests();
		renderSkills();
		alert('Signed in as ' + me.name + ' (' + me.role + ')');
	}

	// wire up page events
	document.addEventListener('DOMContentLoaded',()=>{
		seedIfEmpty();
		renderCurrentUser();

		if(onStudentPage()){
			document.getElementById('search-btn').addEventListener('click',()=>renderSearchResults(document.getElementById('skill-search').value));
			document.getElementById('skill-search').addEventListener('keydown',(e)=>{ if(e.key==='Enter'){ e.preventDefault(); renderSearchResults(e.target.value);} });

			// if the page was opened with a query param (from search bar), prefill and run search
			try{
				const params = new URLSearchParams(window.location.search);
				const q = params.get('q');
				if(q){
					document.getElementById('skill-search').value = decodeURIComponent(q);
					renderSearchResults(decodeURIComponent(q));
				}
			}catch(e){/* ignore malformed URL */}
			const signin = document.getElementById('signin-form');
			if(signin) signin.addEventListener('submit', handleSignin);
			const switchBtn = document.getElementById('switch-to-teacher');
			if(switchBtn) switchBtn.addEventListener('click', ()=>{ window.location.href='dasboard2.html'; });
			// render initial list
			renderSearchResults('');
		}

		if(onTeacherPage()){
			renderRequests();
			renderSkills();
			const addForm = document.getElementById('add-skill-form');
			if(addForm) addForm.addEventListener('submit',(e)=>{ e.preventDefault(); const v=document.getElementById('new-skill').value.trim(); if(v) { addSkill(v); document.getElementById('new-skill').value=''; } });
		}
	});

	// expose some helpers for debugging
	window.SS = {read,write,seedIfEmpty};

})();


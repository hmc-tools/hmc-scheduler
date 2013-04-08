var openNode = false;
var tabIndex = 0;
function addCourse(course, i, courses) {

	// Make a new course node
	var courseNode = document.getElementById('course-template').cloneNode(true);
	courseNode.classList.remove('template');
	course._node = courseNode;
	course._node.toJSON = function () { return undefined; };

	// Fill in the values
	if (course.name) courseNode.querySelector('input[type="text"]').value = course.name;
	courseNode.querySelector('input[type="checkbox"]').checked = course.selected;
	if (course.times) courseNode.querySelector('textarea').value = course.times;	
	if (course.color) courseNode.querySelector('input[type="text"]').style.backgroundColor = course.color;
	
	// Collapsing and expanding
	courseNode.querySelector('input[type="text"]').onfocus = function () {
		if (openNode && openNode != courseNode)
			openNode.classList.add('hidden');
		openNode = courseNode;
		openNode.classList.remove('hidden');
	};
	courseNode.querySelector('input[type="text"]').ondblclick = function () {
		openNode.classList.add('hidden');
		openNode = false;	
	};
	
	// Data updating
	courseNode.querySelector('input[type="text"]').onchange = function () { course.name = this.value; save('courses', courses); };
	courseNode.querySelector('textarea').onchange = function () { 
		course.times = this.value.trim();
		
		// Add a trailing line break to facilitate copy/paste
		if (this.value[this.value.length - 1] != '\n')
			this.value += '\n';
			
		save('courses', courses);
	};
	courseNode.querySelector('input[type="checkbox"]').onchange = function () { course.selected = !!this.checked; save('courses', courses); };	
	
	// Tabbing
	courseNode.querySelector('input[type="text"]').setAttribute('tabindex', ++tabIndex);
	courseNode.querySelector('textarea').setAttribute('tabindex', ++tabIndex);
	
	// Deleting
	courseNode.querySelector('.x').onclick = function () {
		if (confirm('Are you sure you want to delete ' + (course.name || 'this class') + '?')) {
			courses.splice(courses.indexOf(course), 1);
			courseNode.parentNode.removeChild(courseNode);
			save('courses', courses);
			
			if (courses.length == 0) {
				document.getElementById('courses-container').classList.add('empty');
				document.getElementById('courses-container').classList.remove('not-empty');
			}
		}
		return false;
	};
	
	// Change colors
	courseNode.querySelector('.c').onclick = function () {
		courseNode.querySelector('input[type="text"]').style.backgroundColor = course.color = randomColor();
		save('courses', courses);
		return false;
	};
	
	document.getElementById('courses').appendChild(courseNode);
	document.getElementById('courses-container').classList.remove('empty');
	document.getElementById('courses-container').classList.add('not-empty');
}

var randomColor = (function generate() {
	var colorChoices = [];
	for (var i = 0; i < 360; i += 36)
		colorChoices.push('hsl(' + i + ', 73%, 90%)');
	colorChoices = colorChoices.sort(function () { return Math.random() - .5; });
	return function () {
		if (colorChoices.length)
			return colorChoices.pop();
			
		randomColor = generate();
		return randomColor();
	};
}());

function timeToHours(h, m, pm) {
	return h + m / 60 + (pm && h != 12 ? 12 : 0);
}
function formatHours(hours) {
	var h = Math.floor(hours) % 12 || 12;
	var m = Math.round((hours % 1) * 60);
	return h + ':' + ('0' + m).substr(-2) + (hours >= 12 ? 'pm' : 'am');
}

function loadSchedule(schedules, i) {
	
	if (!schedules.length)
		return 0;

	i = Math.min(schedules.length - 1, Math.max(i, 0));
	
	// Some UI
	document.getElementById('button-left').disabled = i == 0;
	document.getElementById('button-right').disabled = i + 1 >= schedules.length;
	document.getElementById('page-number').innerHTML = i + 1;
	document.getElementById('page-count').innerHTML = schedules.length;
	
	drawSchedule(schedules[i]);
	return i;
}

function drawSchedule(schedule) {
	
	var days = Array.prototype.slice.call(document.querySelectorAll('.day'));
	var beginHour = 8 - 0.5; // Starts at 8am
	var hourHeight = document.querySelector('#schedule li').offsetHeight;
	
	// Clear the schedule
	days.forEach(function (day) {
		while (day.firstChild)
			day.removeChild(day.firstChild);
	});
	
	// Add each time slot
	schedule.forEach(function (timeSlot) {
		var div = document.createElement('div');
		div.style.top = hourHeight * (timeSlot.from - beginHour) + 'px';
		div.style.backgroundColor = timeSlot.course.color;
		div.innerHTML = '<b>' + timeSlot.course.name + '</b><br />' + formatHours(timeSlot.from) + ' - ' + formatHours(timeSlot.to);
		
		days[timeSlot.weekday].appendChild(div);
		
		// Vertically center
		var supposedHeight = (timeSlot.to - timeSlot.from) * hourHeight;
		var paddingHeight = (supposedHeight - div.offsetHeight) / 2;
		div.style.padding = paddingHeight + 'px 0';
		div.style.height = (supposedHeight - paddingHeight * 2) + 'px';			
	});
}

function addSavedSchedule(name, schedule, savedSchedules) {
	var div = document.createElement('div');
	
	var scheduleLink = document.createElement('a');
	scheduleLink.href = '#';
	scheduleLink.onclick = function () {
		drawSchedule(schedule);
		return false;
	};
	scheduleLink.appendChild(document.createTextNode(name));
	
	var removeLink = document.createElement('a');
	removeLink.href = '#';
	removeLink.className = 'x';
	removeLink.onclick = function () {
		if (confirm('Are you sure you want to delete this saved schedule?')) {
			div.parentNode.removeChild(div);
			delete savedSchedules[name];
			
			if (document.getElementById('saved-schedules').children.length == 0) {
				document.getElementById('saved-schedules-container').classList.add('empty');
				document.getElementById('saved-schedules-container').classList.remove('not-empty');
			}
			
			save('savedSchedules', savedSchedules);
		}
		return false;
	};
	removeLink.appendChild(document.createTextNode('x'));
	
	div.appendChild(scheduleLink);
	div.appendChild(document.createTextNode(' '));
	div.appendChild(removeLink);
	
	document.getElementById('saved-schedules-container').classList.remove('empty');
	document.getElementById('saved-schedules-container').classList.add('not-empty');
	document.getElementById('saved-schedules').appendChild(div);
}

function generateSchedules(courses) {

	// Parse all the courses from text form into a list of courses, each a list of time slots
	var classes = courses.filter(function (course) { return course.selected && course.times; }).map(function (course) {
	
		// Parse every line separately
		return course.times.split('\n').map(function (timeSlot) {
		
			// Split it into a list of each day's time slot
			var args = [];
			timeSlot.replace(/([MTWRF]+) (\d?\d):(\d\d)\s*(AM|PM)?\s*\-\s?(\d?\d):(\d\d)\s*(AM|PM)?/gi, function (_, daylist, h1, m1, pm1, h2, m2, pm2) {
				daylist.split('').forEach(function (day) {
					args.push({
						'course': course,
						'weekday': 'MTWRF'.indexOf(day), 
						'from': timeToHours(+h1, +m1, (pm1 || pm2) == 'PM'),
						'to': timeToHours(+h2, +m2, (pm2 || pm1) == 'PM'),
					});
				});
			});
			return args;
			
		});	
	});
	
	// Generate all possible combinations
	var combos = [];
	var state = classes.map(function () { return 0; }); // Array of the same length
	while (true) {
	
		// Add this possibility
		combos.push(classes.map(function (course, i) {
			return course[state[i]];
		}));
		
		// Increment state
		var incremented = false;
		for (var i = 0; i < classes.length; i++) {
			if (state[i] < classes[i].length - 1) {
				state[i]++;
				incremented = true;
				break;
			} else
				state[i] = 0;
		}
		
		// We're done.
		if (!incremented)
			break;
	}
		
	// Concatenate all the timeslots
	return combos.map(function (combo) {
		return Array.prototype.concat.apply([], combo);
	})
	
	// And remove conflicting schedules
	.filter(function (timeSlots) {
	
		// Loop over every six minute interval and make sure no two classes occupy it
		for (var day = 0; day < 5; day++) {
		
			var todaySlots = timeSlots.filter(function (timeSlot) { return timeSlot.weekday == day; });
			for (var t = 0; t < 24; t += 0.1)				
				if (todaySlots.filter(function (timeSlot) {
							return timeSlot.from < t && t < timeSlot.to;
						}).length > 1)
					return false;
			
		}
		
		return true;
	});
}

// Store stuff
var lastModified = localStorage.lastModified;
function save(type, arr) {

	if (localStorage.lastModified != lastModified)
		if (!confirm('It looks like the data has been modified from another window. Do you want to overwrite those changes? If not, refresh this page to update its data.')) {
			return;
		}
		
	lastModified = localStorage.lastModified = Date.now();
	localStorage[type] = JSON.stringify(arr);
}

window.onload = function () {

	// Load data
	var courses = localStorage.courses ? JSON.parse(localStorage.courses) : [];
	var savedSchedules = localStorage.savedSchedules ? JSON.parse(localStorage.savedSchedules) : {};
	var schedules = [];
	var schedulePosition = 0;	
	
	// Attach events
	document.getElementById('button-add').onclick = function () { 
		var course = {
			'name': '',
			'selected': true,
			'times': '',
			'color': randomColor()
		};
		courses.push(course);
		addCourse(course, 0, courses);
		save('courses', courses);
	};
	
	document.getElementById('button-save').onclick = function () {
		var name = prompt('What would you like to call this schedule?', '');
		if (name) {
			savedSchedules[name] = JSON.parse(JSON.stringify(schedules[schedulePosition]));
			addSavedSchedule(name, savedSchedules[name], savedSchedules);
			save('savedSchedules', savedSchedules);
		}
	};
	
	document.getElementById('button-generate').onclick = function () {
		schedules = generateSchedules(courses);
		
		// Display them all
		if (schedules.length) {
			document.getElementById('button-save').disabled = '';
			schedulePosition = loadSchedule(schedules, 0);
		}
		
		else
			alert('Sorry! There weren\'t any possible schedules.');
	};
	
	// Navigating schedules
	document.getElementById('button-left').onclick = function () { schedulePosition = loadSchedule(schedules, schedulePosition - 1); };
	document.getElementById('button-right').onclick = function () { schedulePosition = loadSchedule(schedules, schedulePosition + 1); };
	document.onkeydown = function (e) {
		if (e.keyCode == 39)
			schedulePosition = loadSchedule(schedules, schedulePosition + 1);
		else if (e.keyCode == 37)
			schedulePosition = loadSchedule(schedules, schedulePosition - 1);
	};
	
	// For use with the bookmarklet
	window.onhashchange = function () {
		if (!window.location.hash)
			return;
	
		// Extract information from the hash
		try {
			var data = JSON.parse(unescape(window.location.hash.substr(1)));
		} catch (e) {
			return;
		}
		console.log('Received payload ' + data);
		
		var name = data[0];
		var times = data[1];
		var course = false;
		
		// See if the course being passed in is already in the course list
		for (var i = 0; i < courses.length; i++)
			if (courses[i].name == name) {
				course = courses[i];
				break;
			}
			
		// Not there yet? Make it.
		if (!course) {
			course = {
				'name': name,
				'selected': true,
				'times': times,
				'color': randomColor()
			};
			courses.push(course);
			addCourse(course, 0, courses);
		}
		
		// Add this time to the list if it's not already there
		else {
			var existingTimes = course.times.split('\n');
			if (existingTimes.indexOf(times) == -1) {
				existingTimes.push(times);
				course._node.querySelector('textarea').value = course.times = existingTimes.join('\n');
				course._node.querySelector('input[type="text"]').onfocus();
			}
		}
		
		save('courses', courses);
		window.location.hash = '';
	};
	window.onhashchange();
	
	// Display all the courses
	if (courses.length) {
		courses.forEach(addCourse);
		document.getElementById('button-generate').onclick();
	}
	
	// Display all the saved schedules
	for (var name in savedSchedules)
		addSavedSchedule(name, savedSchedules[name], savedSchedules);
	
	// Make the bookmarklet
	document.getElementById('bookmarklet').onclick = function () {
		alert('Drag this to your bookmarks bar. Search for your classes on Portal, and when you find a class you like on the search page, click the bookmark!');
		return false;
	};
	document.getElementById('bookmarklet').href = 'javascript:' + 
			escape('(function(__URL__){'
				+ document.querySelector('script[type="text/x-js-bookmarklet"]').innerHTML.replace(/\s+/g, ' ') 
				+ '}("' + window.location.toString().split('#')[0] + '"));');
};
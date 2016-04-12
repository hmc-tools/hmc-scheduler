var options = {
	'showSections': false
};

function randomColor(seed) {
	if (!seed)
		seed = '' + Math.random();
		
	// Use a hash function (djb2) to generate a deterministic but "random" color.
	var hash = 5381 % 359;
	for (var i = 0; i < seed.length; i++)
		hash = (((hash << 5) + hash) + seed.charCodeAt(i)) % 359;

	return 'hsl(' + hash + ', 73%, 90%)'
	// Even though we should use "% 360" for all possible values, using 359 makes for fewer hash collisions.
}

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
	courseNode.querySelector('input[type="text"]').style.backgroundColor = course.color || randomColor(course.name);
	
	// Collapsing and expanding
	courseNode.querySelector('input[type="text"]').onfocus = function () {
		if (openNode && openNode != courseNode)
			openNode.classList.add('hidden');
		openNode = courseNode;
		openNode.classList.remove('hidden');
	};
	/*courseNode.querySelector('input[type="text"]').ondblclick = function () {
		openNode.classList.add('hidden');
		openNode = false;	
	};*/
	
	// Data updating
	courseNode.querySelector('input[type="text"]').onchange = function () {
		course.name = this.value; 
		
		save('courses', courses);
		document.getElementById('button-generate').disabled = false;
	};
	courseNode.querySelector('textarea').onchange = function () { 
		course.times = this.value.trim();
		
		// Add a trailing line break to facilitate copy/paste
		if (this.value[this.value.length - 1] != '\n')
			this.value += '\n';
			
		save('courses', courses);
		document.getElementById('button-generate').disabled = false;
	};
	courseNode.querySelector('input[type="checkbox"]').onchange = function () {
		course.selected = !!this.checked;
		save('courses', courses);
		document.getElementById('button-generate').disabled = false;
	};	
	
	// Tabbing
	courseNode.querySelector('input[type="text"]').setAttribute('tabindex', ++tabIndex);
	courseNode.querySelector('textarea').setAttribute('tabindex', ++tabIndex);
	
	// Deleting
	courseNode.querySelector('.x').onclick = function () {
		if (confirm('Are you sure you want to delete ' + (course.name || 'this class') + '?')) {
			courses.splice(courses.indexOf(course), 1);
			courseNode.parentNode.removeChild(courseNode);
			save('courses', courses);
			document.getElementById('button-generate').disabled = false;
			
			if (courses.length == 0) {
				document.getElementById('courses-container').classList.add('empty');
				document.getElementById('courses-container').classList.remove('not-empty');
			}
		}
		return false;
	};
	
	// Change colors
	courseNode.querySelector('.c').onclick = function () {
		var color = course.color || randomColor(course.name);
		courseNode.querySelector('input[type="text"]').style.backgroundColor = course.color = color.replace(/\d+/, function (hue) { return (+hue + 24) % 360; });
		save('courses', courses);
		document.getElementById('button-generate').disabled = false;
		return false;
	};
		
	document.getElementById('courses').appendChild(courseNode);
	document.getElementById('courses-container').classList.remove('empty');
	document.getElementById('courses-container').classList.add('not-empty');
	
	document.getElementById('button-generate').disabled = false;
}

function timeToHours(h, m, pm) {
	return h + m / 60 + (pm && h != 12 ? 12 : 0);
}
function formatHours(hours) {
	var h = Math.floor(hours) % 12 || 12;
	var m = Math.round((hours % 1) * 60);
	return h + ':' + ('0' + m).substr(-2) + (hours >= 12 ? 'pm' : 'am');
}

function loadSchedule(schedules, i) {

	i = Math.min(schedules.length - 1, Math.max(i, 0));
	
	// Some UI
	document.getElementById('button-left').disabled = i <= 0;
	document.getElementById('button-right').disabled = i + 1 >= schedules.length;
	document.getElementById('page-number').innerHTML = i + 1;
	document.getElementById('page-count').innerHTML = schedules.length;
	document.getElementById('button-save').disabled = schedules.length == 0;
	document.getElementById('button-export').disabled = schedules.length == 0;
	document.getElementById('button-print').disabled = schedules.length == 0;
	
	document.getElementById('page-counter').classList.add(schedules.length ? 'not-empty' : 'empty');
	document.getElementById('page-counter').classList.remove(schedules.length ? 'empty' : 'not-empty');
	
	drawSchedule(schedules[i] || []);
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
		div.style.backgroundColor = timeSlot.course.color || randomColor(timeSlot.course.name);
		div.innerHTML = (options.showSections && timeSlot.section ? 
				timeSlot.section.replace(/^([^(]+)\((.*)\)/, function (_, code, profs) {
					return '<b>' + code + '</b><br />' + profs;
				}) 
				: '<b>' + timeSlot.course.name + '</b>') + 
			'<br />' + formatHours(timeSlot.from) + ' - ' + formatHours(timeSlot.to);
		
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
		document.getElementById('button-generate').disabled = false;
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

function download(filename, text) {
	var a = document.createElement('a');
	a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(text);
	a.download = filename;

	a.style.display = 'none';
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
}

function exportSchedule(mapOfCourses) {
	var header = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//HMC Scheduler//EN\n';
	var footer = 'END:VCALENDAR\n';
	var result = '';
	result += header;
	for (i in mapOfCourses)	{
		var vevent = new VEventObject(mapOfCourses[i]);
		result += vevent.toString();
	}
	result += footer;
	return result;
}

function padZero(n, pad) {
	var s = '' + n;
	while (s.length < pad) 
		s = '0' + s;
	return s;
}

function formatDate(date) {
	return [
		padZero(date.getFullYear(), 4),
		padZero(date.getMonth() + 1, 2),
		padZero(date.getDate(), 2),
		'T',
		padZero(date.getHours(), 2),
		padZero(date.getMinutes(), 2),
		padZero(date.getSeconds(), 2)
	].join('');
}

function VEventObject(timeBlocks) {
	this.weekdays = [];
	for (i in timeBlocks)
		this.weekdays.push(timeBlocks[i].weekday);
	this.startTime = timeBlocks[0].from;
	this.endTime = timeBlocks[0].to;
	this.startDate = new Date(Date.parse(timeBlocks[0].course.data.startDate));

	// Update the start date of the class to the first day where there is
	// actually a class (according to the MTWRF flags)
	var startDay = this.startDate.getDay();
	var daysTillClasses = this.weekdays.map(function (weekday) {
		var day = weekday + 1;
		return (7 + day - startDay) % 7;
	});
	var daysTillFirstClass = Math.min.apply(null, daysTillClasses);
	this.startDate.setDate(this.startDate.getDate() + daysTillFirstClass);

	this.endDate = new Date(Date.parse(timeBlocks[0].course.data.endDate));
	this.name = timeBlocks[0].course.name;
	this.loc = timeBlocks[0].loc;
	this.toString = function () {
		var days = ['MO', 'TU', 'WE', 'TH', 'FR'];
		var startDateFull = dateAddHoursAndMinutes(this.startDate, this.startTime);
		var endDateFull = dateAddHoursAndMinutes(this.startDate, this.endTime); //no "overnight" classes
		var header = 'BEGIN:VEVENT\n';
		var footer = 'END:VEVENT\n';
		var uid = 'UID:' + this.startDate + this.startTime + '-' + (new Date()).getTime() + '\n';
		var dtstart = 'DTSTART:' + formatDate(startDateFull) + '\n';
		var dtend = 'DTEND:' + formatDate(endDateFull) + '\n';
		var dtstamp = 'DTSTAMP:' + formatDate(new Date()) + '\n';
		var place = 'LOCATION:' + this.loc.replace(/,/g, '\\,').replace(/\n/g, '') + '\n';
		var rrule = 'RRULE:FREQ=WEEKLY;BYDAY=' + this.weekdays.map(function(day) { return days[day]; }).join(',') + ';UNTIL=' + formatDate(this.endDate) + '\n';
		var title = 'SUMMARY:' + this.name.replace(/,/g, '\\,') + '\n';
		return header + uid + dtstart + dtend + dtstamp + place + rrule + title + footer;
	};
}

function dateAddHoursAndMinutes(date, fracHours) {
	var hours = Math.floor(fracHours);
	var minutes = (fracHours - hours) * 60;
	var newDate = new Date(date);
	newDate.setHours(hours);
	newDate.setMinutes(minutes);
	return newDate;
}

function mapCourses(schedules) {
	var mapOfCourses = {};
	for (var i = 0; i < schedules.length; i++) {
		var timeBlock = schedules[i];
		var key = timeBlock.course.name + timeBlock.loc + (' ' + timeBlock.from + ' ' + timeBlock.to);
		if (!mapOfCourses[key])
			mapOfCourses[key] = [];
		mapOfCourses[key].push(timeBlock);
	}
	return mapOfCourses;
}

function generateSchedules(courses) {
	// Parse all the courses from text form into a list of courses, each a list of time slots
	var classes = courses.filter(function (course) { return course.selected && course.times; }).map(function (course) {
		// Parse every line separately
		return course.times.split('\n').map(function (timeSlot) {
		
			// Extract the section info from the string, if it's there.
			var section = timeSlot.indexOf(': ') > -1 ? timeSlot.split(': ')[0] : '';
			
			// Split it into a list of each day's time slot
			var args = [];
			// The lookahead at the end is because meeting times are delimited by commas (oops), but the location may contain commas.
			timeSlot.replace(/([MTWRF]+) (\d?\d):(\d\d)\s*(AM|PM)?\s*\-\s?(\d?\d):(\d\d)\s*(AM|PM)?;([^;]*?)(?=$|, \w+ \d?\d:\d{2})/gi, function (_, daylist, h1, m1, pm1, h2, m2, pm2, loc) {
				daylist.split('').forEach(function (day) {
					args.push({
						'course': course,
						'section': section,
						'loc': loc.trim(),
						'weekday': 'MTWRF'.indexOf(day),
						'from': timeToHours(+h1, +m1, (pm1 || pm2).toUpperCase() == 'PM'),
						'to': timeToHours(+h2, +m2, (pm2 || pm1).toUpperCase() == 'PM'),
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
function messageOnce(str) {
	if (localStorage['message_' + str])
		return false;
		
	localStorage['message_' + str] = true;
	return true;
}

(function () {
	var VERSION = 3;

	// Version check
	if (window.location.hash.indexOf('#!v=') == 0) {
		if (+window.location.hash.substr('#!v='.length) < VERSION)
			alert('Your bookmarklet looks outdated! You should redrag the bookmark to the bookmarks bar and try again.');
		window.location.hash = '#';
	}
	
	// Version check
	if ((!localStorage.schedulerVersion || localStorage.schedulerVersion < VERSION) && localStorage.courses) {
		localStorage.schedulerVersion = VERSION;
//		alert('Update: you can now show section numbers with the checkbox next to the Generate button. Unfortunately, for it to work, you\'ll need to redrag the bookmarklet, delete all your classes, and re-add them. Sorry!');
	}
	
	// It looks like they clicked directly on the bookmark without going to Portal.
	if (window.location.hash == '#!bookmarklet') {
		if (messageOnce('search-portal'))
			alert('Go to Portal before you click this bookmark!');
			
		window.location.hash = '#';
	}
	
	// Check if it's an older version...
	window.onhashchange = function () {
		try {
			if (JSON.parse(unescape(window.location.hash.substr(1)))[0])
				alert('Your bookmarklet looks outdated! You should redrag the bookmark to the bookmarks bar and try again.');
		} catch (e) {}
	};
	window.onhashchange();

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
			'times': ''
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
		schedulePosition = loadSchedule(schedules, 0);
		
		// The credit count
		var count = courses.filter(function (course) { 
			return course.selected;
		}).map(function (course) {
			if (!course.data)
				return NaN;
			
			// Mudd courses are worth their full value.
			if (course.data['courseCode'].indexOf(' HM-') != -1)
				return course.data['credits'];
			
			// Other colleges' courses need to be multiplied by three.
			return course.data['credits'] * 3;
		}).reduce(function (a, b) {
			return a + b;
		}, 0);
		document.getElementById('credit-counter').innerHTML = isNaN(count) ? '' : '(' + count.toFixed(1) + ' credits)';
		
		this.disabled = true;
	};
	
	document.getElementById('button-sections').checked = options.showSections = localStorage.showSections;
	document.getElementById('button-sections').onclick = function () {
		localStorage.showSections = options.showSections = this.checked;
		document.getElementById('button-generate').onclick();
	};
	
	// Navigating schedules
	document.getElementById('button-left').onclick = function () { schedulePosition = loadSchedule(schedules, schedulePosition - 1); };
	document.getElementById('button-right').onclick = function () {
		schedulePosition = loadSchedule(schedules, schedulePosition + 1);
		this.classList.add('clicked');
	};
	document.onkeydown = function (e) {
		if (e.keyCode == 39)
			document.getElementById('button-right').onclick();
		else if (e.keyCode == 37)
			document.getElementById('button-left').onclick();
	};
	
	// Messages from the bookmarklet
	window.onmessage = function (e) {
		// Extract information from the message
		try {
			var data = JSON.parse(e.data);
		} catch (e) {
			return;
		}
		
		var name = data['courseName'];
		
		// Build the timeSlot string.
		var timeSlot = 
			data['courseCode'].replace(/\s+/g, ' ') + ' (' +
			
			data['professors'].map(function (prof) {
					// Only last names to save space.
					return prof.split(',')[0];
				}).join(', ') + '): ' + 
				
			data['timeSlots'].filter(function (timeSlot) {
					// Make sure they're actually of the correct format
					return /([MTWRF]+) (\d?\d):(\d\d)\s*(AM|PM)?\s*\-\s?(\d?\d):(\d\d)\s*(AM|PM)?/gi.test(timeSlot);
				}).filter(function (timeSlot, i, arr) {
					// Remove duplicates
					return arr.lastIndexOf(timeSlot) == i;
				}).join(', ');
		
		// See if the course being passed in is already in the course list
		var course = false;
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
				'times': timeSlot,
				'data': data
			};
			courses.push(course);
			addCourse(course, 0, courses);
		}
		
		// Add this time to the list if it's not already there
		else {
			course.data = data;
			var existingTimes = course.times.split('\n');
			if (existingTimes.indexOf(timeSlot) == -1) {
				existingTimes.push(timeSlot);
				course._node.querySelector('textarea').value = course.times = existingTimes.join('\n');
			}
			course._node.querySelector('input[type="text"]').onfocus();
		}
		
		save('courses', courses);
		document.getElementById('button-generate').onclick();
	};
	
	// Display all the courses
	if (courses.length) {
		courses.forEach(addCourse);
		document.getElementById('button-generate').onclick();
	}
	
	// Display all the saved schedules
	for (var name in savedSchedules)
		addSavedSchedule(name, savedSchedules[name], savedSchedules);
	
	// Sigh, browser detection
	var detection = {
		'chrome': !!window.chrome,
		'webkit': navigator.userAgent.toLowerCase().indexOf('safari') > -1,
		'firefox': navigator.userAgent.toLowerCase().indexOf('firefox') > -1,
		'mac': navigator.userAgent.toLowerCase().indexOf('mac os') > -1
	};
	
	// Firefox printing is ugly
	if (detection['firefox'])
		document.getElementById('button-print').style.display = 'none';
	
	document.getElementById('button-print').onclick = function () {
		if (detection['chrome'] && messageOnce('print-tip'))
			alert('Pro-tip: Chrome has an option on the Print dialog to disable Headers and Footers, which makes for a prettier schedule!');
		window.print();
	};
	
	// Make the bookmarklet
	document.getElementById('bookmarklet').onclick = function () {
		alert('Drag this link to your bookmarks bar. (If you don\'t see the bookmarks bar, '
			+ (
				   (detection['webkit'] && 'press ' + (detection['mac'] ? 'Cmd' : 'Ctrl') + '-Shift-B to show it')
				|| (detection['firefox'] && 'right-click the tab bar and click "Bookmarks Toolbar" to show it')
				|| 'you\'ll need to enable it. The bookmarklet doesn\'t work if you simply bookmark this page'
			) + '.) Then, go to Portal and click the Scheduler bookmarklet!');
		return false;
	};
	document.getElementById('bookmarklet').href = 'javascript:' + 
			escape('(function(__URL__,__VERSION__){'
				// Replace spaces and /* comments */
				+ document.querySelector('script[type="text/x-js-bookmarklet"]').innerHTML.replace(/(\s+|\/\*[\S\s]*?\*\/)/g, ' ')
				+ '}("' + window.location.toString().split('#')[0] + '", ' + VERSION + '));');
				
	document.getElementById('bookmark-helper').title =
				   (detection['webkit'] && 'press ' + (detection['mac'] ? 'Cmd' : 'Ctrl') + '-Shift-B to show it')
				|| (detection['firefox'] && 'right-click the tab bar and click "Bookmarks Toolbar" to show it')
				|| '';
	
	document.getElementById('button-clear').onclick = function () {
		if (confirm('Are you sure you want to delete all the courses you\'ve added?')) {
			save('courses', courses = []);
			window.location.reload();
		}
			
		return false;
	};
	
	document.getElementById('button-export').onclick = function () {
		var mapOfCourses = mapCourses(schedules[schedulePosition]);
		
		var scheduleText = exportSchedule(mapOfCourses); 
		download("schedule.ics", scheduleText);
	};
	document.getElementById('button-prologify').onclick = function () {
		function prologify(arg) {
			if (Array.isArray(arg))
				return '[' + arg.map(prologify) + ']';
			if (typeof arg == 'string')
				return "'" + arg + "'";
			return arg;	
		}
		
		function dateToArray(dateStr) {
			return dateStr.split('/').map(Number);
		}

		var clauses = [];
		courses
			.filter(function (course) { return course.times; })
			.map(function (course) {
				
				// Parse every line separately
				var sections = course.times.split('\n').map(function (timeSlot) {
				
					// Extract the section info from the string, if it's there.
					var section = timeSlot.indexOf(': ') > -1 ? timeSlot.split(': ')[0] : '';
					var crs, sec, profs;
					section.replace(/^(.{4}[^\s]*)\s+(.{5})\s+\(([^)]*)\)/, function (_, crs_, sec_, profs_) {
						crs = crs_;
						sec = sec_;
						profs = profs_;
					});
					
					// Split it into a list of each day's time slot
					var slots = [];
					// The lookahead at the end is because meeting times are delimited by commas (oops), but the location may contain commas.
					timeSlot.replace(/([MTWRF]+) (\d?\d):(\d\d)\s*(AM|PM)?\s*\-\s?(\d?\d):(\d\d)\s*(AM|PM)?;([^;]*?)(?=$|, \w+ \d?\d:\d{2})/gi, function (_, daylist, h1, m1, pm1, h2, m2, pm2, loc) {
						daylist.split('').forEach(function (day) {
							slots.push([
								'MTWRFSU'.indexOf(day),
								timeToHours(+h1, +m1, (pm1 || pm2).toUpperCase() == 'PM'),
								timeToHours(+h2, +m2, (pm2 || pm1).toUpperCase() == 'PM'),
								loc.trim().replace(/\s+/g, ' ')
							]);
						});
					});
					
					return [crs, sec, course.data.credits, dateToArray(course.data.startDate), dateToArray(course.data.endDate), profs.split(/,\s*/g), slots];
				});
				
				clauses.push(prologify(sections));
			});
			
		var prolog = clauses.join('.\n') + '.';
		download('courses.data', prolog);
	};
	
	// Silly workaround to circumvent crossdomain policy
	if (window.opener)
		window.opener.postMessage('loaded', '*');
}());

/*global window, console, chrome*/
/*jslint sloppy: true*/
window.addEventListener('load', function () {
    var searcFuncPrefix = "(" + findAll.toString() + '(',
        tests = {
            byName : '"byName", "!", #));',
            byValue : '"byValue", !, #));',
            byType : '"byKind", !, #));'
        };
    function onSearch(e) {
        var keys = Object.keys(tests);
        for (var i = 0; i < keys.length; i++) {
            var searchTerm = this[keys[i]].value,
                isStrict = this.isStrict.checked;

            if (searchTerm) {
                if (keys[i] === 'byValue' && !/^(\d|-)?(\d|,)*\.?\d*$/.test(searchTerm)) {
                    // it's a string, make sure it's wrapped in quotes:
                    searchTerm = JSON.stringify(searchTerm);
                }
                searchTerm = tests[keys[i]].replace(/#/, isStrict).replace(/!/, searchTerm);
                chrome.devtools.inspectedWindow.eval(searcFuncPrefix + searchTerm);
                this[keys[i]].value = "";
                break;
            }
        };

        e.preventDefault();
    }

    var searchForm = document.getElementById('search');
    searchForm.addEventListener('submit', onSearch);
});

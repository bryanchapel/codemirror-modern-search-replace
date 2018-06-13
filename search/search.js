(function (mod) {
    mod(require('codemirror'), require('./searchcursor'), require('./dialog'));
})(function (CodeMirror) {
    'use strict';

    function searchOverlay (query, caseInsensitive) {
        if (typeof query == 'string') { query = new RegExp(query.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&'), caseInsensitive ? 'gi' : 'g'); } else if (!query.global) { query = new RegExp(query.source, query.ignoreCase ? 'gi' : 'g'); }

        return {token: function (stream) {
            query.lastIndex = stream.pos;
            let match = query.exec(stream.string);
            if (match && match.index == stream.pos) {
                stream.pos += match[0].length || 1;
                return 'searching';
            } else if (match) {
                stream.pos = match.index;
            } else {
                stream.skipToEnd();
            }
        }};
    }

    function SearchState () {
        this.posFrom = this.posTo = this.lastQuery = this.query = null;
        this.overlay = null;
    }

    function getSearchState (cm) {
        return cm.state.search || (cm.state.search = new SearchState());
    }

    function queryCaseInsensitive (query) {
        return typeof query === 'string' && query === query.toLowerCase();
    }

    function getSearchCursor (cm, query, pos) {
        // Heuristic: if the query string is all lowercase, do a case insensitive search.
        return cm.getSearchCursor(query, pos, {caseFold: queryCaseInsensitive(query), multiline: true});
    }

    function persistentDialog (cm, template, deflt, onEnter, onKeyDown) {
        if (document.querySelector('.CodeMirror-search-field')) return;

        cm.openDialog(template, onEnter, {
            value: deflt,
            selectValueOnOpen: true,
            closeOnEnter: false,
            closeOnBlur: false,
            onClose: function () { clearSearch(cm); },
            onKeyDown: onKeyDown
        });
    }

    function parseString (string) {
        return string.replace(/\\(.)/g, function (_, ch) {
            if (ch == 'n') return '\n';
            if (ch == 'r') return '\r';
            return ch;
        });
    }

    function parseQuery (query) {
        let isRE = query.match(/^\/(.*)\/([a-z]*)$/);
        if (isRE) {
            try { query = new RegExp(isRE[1], isRE[2].indexOf('i') == -1 ? '' : 'i'); } catch (e) {} // Not a regular expression after all, do a string search
        } else {
            query = parseString(query);
        }
        if (typeof query == 'string' ? query == '' : query.test('')) { query = /x^/; }
        return query;
    }

    function getNumberOfSearchResults () {
        setTimeout(function () {
            let numSearchResults = document.querySelectorAll('.cm-searching').length,
                resultsText = 'No Results';

            if (numSearchResults !== 0) resultsText = `${numSearchResults} Results`;

            document.querySelector('.CodeMirror-dialog .num-search-results').innerText = resultsText;
        }, 120);
    }

    // TODO: insert <span class="num-search-results">No Results</span> once the bug for 'only showing results currently in the buffer' is resolved.
    const queryDialogTemplate = `
        <div class="find-box">
        <a class="far fa-window-close" onclick="(function(){var dialog = document.querySelector('.CodeMirror-dialog'); document.querySelector('.CodeMirror').removeChild(dialog); editor.codemirror.focus(); editor.codemirror.execCommand('clearSearch'); })();"></a>
        <span class="CodeMirror-search-label"></span>
        <input placeholder="Find" type="text" class="CodeMirror-search-field"/>
        <a class="far fa-caret-square-left" onclick="editor.codemirror.execCommand('findPrev');"></a>
        <a class="far fa-caret-square-right" onclick="editor.codemirror.execCommand('findNext');"></a>
        <a style="float: right;" class="replace-toggle-show far fa-caret-square-down" onclick="(function(){document.querySelector('.replace-box').classList.toggle('display-none'); document.querySelector('.replace-toggle-show').classList.toggle('display-none'); })();"></a>
        </div>
        <div class="replace-box display-none" style="margin-top:10px">
        <a class="fas fa-window-close" style="visibility:hidden;"></a>
        <input placeholder="Replace" type="text" class="CodeMirror-replace-field"/>
        <button onclick="editor.codemirror.execCommand('replace');">Replace</button>
        <button onclick="editor.codemirror.execCommand('replaceAll');">Replace All</button>
        <a style="float: right;" class="replace-toggle-hide far fa-caret-square-up" onclick="(function(){document.querySelector('.replace-box').classList.toggle('display-none'); document.querySelector('.replace-toggle-show').classList.toggle('display-none'); })();"></a>
        </div>
    `;

    function startSearch (cm, state, query) {
        state.queryText = query;
        state.query = parseQuery(query);
        cm.removeOverlay(state.overlay, queryCaseInsensitive(state.query));
        state.overlay = searchOverlay(state.query, queryCaseInsensitive(state.query));
        cm.addOverlay(state.overlay);
        if (cm.showMatchesOnScrollbar) {
            if (state.annotate) { state.annotate.clear(); state.annotate = null; }
            state.annotate = cm.showMatchesOnScrollbar(state.query, queryCaseInsensitive(state.query));
        }
    }

    let searchNext = function (query, event) {
        let cm = editor.codemirror,
            state = getSearchState(cm);

        CodeMirror.e_stop(event);

        if (!query) return;

        if (query != state.queryText) {
            startSearch(cm, state, query);
            state.posFrom = state.posTo = cm.getCursor();
        }

        findNext(cm, event.shiftKey, function (_, to) {
            let dialog = cm.display.wrapper.querySelector('.CodeMirror-dialog');
            // Reduce the dialog's opacity if the search result is at the top of the window
            if (to.line < 3 && dialog.getBoundingClientRect().bottom - 4 > cm.cursorCoords(to, 'window').top) {
                dialog.style.opacity = 0.4;
            } else {
                dialog.style.opacity = 1;
            }
        });
        // getNumberOfSearchResults();
    };

    function doSearch (cm, rev) {
        let state = getSearchState(cm);
        if (state.query) {
            return findNext(cm, rev, function (_, to) {
                let dialog = cm.display.wrapper.querySelector('.CodeMirror-dialog');
                // Reduce the dialog's opacity if the search result is at the top of the window
                if (to.line < 3 && dialog.getBoundingClientRect().bottom - 4 > cm.cursorCoords(to, 'window').top) {
                    dialog.style.opacity = 0.4;
                } else {
                    dialog.style.opacity = 1;
                }
            });
        }

        let lastQueryOrSelection = cm.getSelection() || state.lastQuery;

        if (lastQueryOrSelection instanceof RegExp && lastQueryOrSelection.source == 'x^') lastQueryOrSelection = null;

        if (cm.openDialog) {
            persistentDialog(cm, queryDialogTemplate, lastQueryOrSelection, searchNext, function (event, query) {
                // This callback fires on every keydown.
            });
        }
    }

    function findButton (cm, rev) {
        let searchQuery = document.querySelector('.CodeMirror-search-field').value,
            state = getSearchState(cm);
        if (!searchQuery) return;

        if (searchQuery != state.queryText) {
            startSearch(cm, state, searchQuery);
            state.posFrom = state.posTo = cm.getCursor();
        }

        if (state.query === null && state.lastQuery === null && searchQuery) {
            startSearch(cm, state, searchQuery);
        }

        findNext(cm, rev, function (_, to) {
            let dialog = cm.display.wrapper.querySelector('.CodeMirror-dialog');
            // Reduce the dialog's opacity if the search result is at the top of the window
            if (to.line < 3 && dialog.getBoundingClientRect().bottom - 4 > cm.cursorCoords(to, 'window').top) {
                dialog.style.opacity = 0.4;
            } else {
                dialog.style.opacity = 1;
            }
        });
        // getNumberOfSearchResults();
    }

    function findNext (cm, rev, callback) {
        cm.operation(function () {
            let state = getSearchState(cm),
                cursor = getSearchCursor(cm, state.query, rev ? state.posFrom : state.posTo);

            if (!cursor.find(rev)) {
                cursor = getSearchCursor(cm, state.query, rev ? CodeMirror.Pos(cm.lastLine()) : CodeMirror.Pos(cm.firstLine(), 0));
                if (!cursor.find(rev)) return;
            }

            cm.setSelection(cursor.from(), cursor.to());
            cm.scrollIntoView({from: cursor.from(), to: cursor.to()}, 50);

            state.posFrom = cursor.from(); state.posTo = cursor.to();

            if (callback) callback(cursor.from(), cursor.to());
        });
    }

    function clearSearch (cm) {
        cm.operation(function () {
            let state = getSearchState(cm);
            state.lastQuery = state.query;
            if (!state.query) return;
            state.query = state.queryText = null;
            cm.removeOverlay(state.overlay);
            if (state.annotate) { state.annotate.clear(); state.annotate = null; }
        });
    }

    function replaceAll (cm, query, text) {
        cm.operation(function () {
            for (let cursor = getSearchCursor(cm, query); cursor.findNext();) {
                if (typeof query != 'string') {
                    let match = cm.getRange(cursor.from(), cursor.to()).match(query);
                    cursor.replace(text.replace(/\$(\d)/g, function (_, i) { return match[i]; }));
                } else {
                    cursor.replace(text);
                }
            }
        });
        // getNumberOfSearchResults();
    }

    function replace (cm, all) {
        if (cm.getOption('readOnly')) return;
        let query = cm.getSelection() || getSearchState(cm).lastQuery,
            text = document.querySelector('.CodeMirror-replace-field').value;

        if (!query) return;
        if (!text) return;

        query = parseQuery(query);
        text = parseString(text);

        if (all) {
            replaceAll(cm, query, text);
        } else {
            // clearSearch(cm);
            let cursor = getSearchCursor(cm, query, cm.getCursor('from')),
                match;

            let advance = function () {
                let start = cursor.from();
                if (!(match = cursor.findNext())) {
                    cursor = getSearchCursor(cm, query);
                    if (!(match = cursor.findNext()) || (start && cursor.from().line == start.line && cursor.from().ch == start.ch)) return;
                }
                cm.setSelection(cursor.from(), cursor.to());
                cm.scrollIntoView({from: cursor.from(), to: cursor.to()});
            };

            let doReplace = function (match) {
                cursor.replace(typeof query == 'string' ? text : text.replace(/\$(\d)/g, function (_, i) { return match[i]; }));
                advance();
            };

            advance();
            doReplace(match);
        }
        // getNumberOfSearchResults();
    }

    CodeMirror.commands.find = function (cm) { clearSearch(cm); doSearch(cm, false); };
    CodeMirror.commands.findNext = function (cm) { findButton(cm, false); };
    CodeMirror.commands.findPrev = function (cm) { findButton(cm, true); };
    CodeMirror.commands.clearSearch = clearSearch;
    CodeMirror.commands.replace = function (cm) { replace(cm, false); };
    CodeMirror.commands.replaceAll = function (cm) { replace(cm, true); };
});

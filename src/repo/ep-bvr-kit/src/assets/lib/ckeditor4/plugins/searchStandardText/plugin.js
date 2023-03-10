/**
 * @fileOverview The "searchStandardText" plugin.
 * This plugin is used to add prediction text to work instructions editor.
 */
'use strict';

(function() {
    /* globals CKEDITOR: false */
    CKEDITOR.plugins.add('searchStandardText', {
        init: function(editor) {
            /** */
            function matchKeyboardShortcut(range) {
                if (!range.collapsed) {
                    return null;
                }
                return CKEDITOR.plugins.textMatch.match(range, matchCallback);
            }

            /** */
            function matchCallback(text, offset) {
                //Regex for character '\\' to open standard text search popup
                var pattern = /\\{2}(?!.)(?!(\w|\s))/;
                var match = text.slice(0, offset)
                    .match(pattern);
                if (!match) {
                    editor.eventBus.publish("wi.closeAutoPredictListPopup");
                    return null;
                }
                var popupOffset = getPopupOffset();
                var viewTobeLoaded= 'standardTextSearchList'

                var eventData = {
                    popupOffset : popupOffset,
                    viewTobeLoaded : viewTobeLoaded
                }
                editor.eventBus.publish("wi.openAutoPredictPopup", eventData);

                return {
                    start: match.index,
                    end: offset
                };
            }

            /** */
            function getPopupOffset() {
                var dummyElement = editor.document.createElement('span');
                editor.insertElement(dummyElement);
                var obj = dummyElement.$;
                var cursor = {
                    x: 0,
                    y: 0
                };

                cursor.keydown = false;

                while (obj.offsetParent) {
                    cursor.x += obj.offsetLeft;
                    cursor.y += obj.offsetTop;
                    obj = obj.offsetParent;
                }
                cursor.x += obj.offsetLeft;
                cursor.y += obj.offsetTop;
                cursor.keydown = true;

                dummyElement.remove();

                var popupWidth = 350;
                var shiftOffset = 5;

                //get CKEDITOR instance offset
                var ckeditorInstanceID = $(".wi-editor-textarea #cke_" + editor.name);

                var leftOffset = ckeditorInstanceID.offset().left + cursor.x + shiftOffset;
                var topOffset = ckeditorInstanceID.offset().top + cursor.y + shiftOffset;

                //if popup does not fit in the WI Container
                if (cursor.x + popupWidth > ckeditorInstanceID.width() && cursor.x - popupWidth > 0) {
                    leftOffset = ckeditorInstanceID.offset().left + cursor.x - popupWidth - shiftOffset;
                }
                return {
                    top: topOffset,
                    left: leftOffset
                };

            }

            var autocomplete = new CKEDITOR.plugins.autocomplete(editor, {
                textTestCallback: matchKeyboardShortcut,
                dataCallback: function filterListByText(matchInfo, callback) {
                    callback(null);
                }
            });
        }
    });
})();

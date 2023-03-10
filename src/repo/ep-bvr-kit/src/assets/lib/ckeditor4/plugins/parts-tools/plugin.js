/**
 * @fileOverview The "parts-tools" plugin.
 * This plugin is used to add parts and tools elements to work instructions editor.
 */
'use strict';

(function() {
    CKEDITOR.plugins.add('parts-tools', {
        requires: 'widget',

        onLoad: function() {
            // Register styles for parts-tools widget frame.
            CKEDITOR.addCss('parts-tools{background-color:#fff;color:#009898}');
            CKEDITOR.addCss('parts-tools{display:inline}');
            CKEDITOR.addCss('.cke_widget_wrapper:hover>.cke_widget_element{outline:none}');
            CKEDITOR.addCss('.cke_widget_wrapper.cke_widget_focused>.cke_widget_element, .cke_widget_wrapper .cke_widget_editable.cke_widget_editable_focused{outline:none} .cke_widget_wrapper{display:inline}');

        },

        init: function(editor) {

            editor.widgets.add('parts-tools', {
                template: '<parts-tools></parts-tools>',
                upcast: function(el) {
                    var isParts = el.name === 'parts-tools';
                    return isParts;
                }
            });
        }
    });

})();

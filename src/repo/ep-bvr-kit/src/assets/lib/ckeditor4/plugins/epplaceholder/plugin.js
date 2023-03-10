/**
 * @license Copyright (c) 2003-2018, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @fileOverview The "placeholder" plugin.
 *
 */

'use strict';

( function() {
    CKEDITOR.plugins.add( 'epplaceholder', {
        requires: 'placeholder',
        icons: 'epplaceholder', // %REMOVE_LINE_CORE%
        hidpi: true, // %REMOVE_LINE_CORE%

        onLoad: function() {
            // Register styles for placeholder widget frame.
            CKEDITOR.addCss( '.cke_epplaceholder{background-color:#fff;color:#009898}' );
            CKEDITOR.addCss( '.cke_widget_wrapper:hover>.cke_widget_element{outline:none}' );
            CKEDITOR.addCss( '.cke_widget_wrapper.cke_widget_focused>.cke_widget_element, .cke_widget_wrapper .cke_widget_editable.cke_widget_editable_focused{outline:none}' );
        },

        init: function( editor ) {

            // Register dialog.
            CKEDITOR.dialog.add( 'epplaceholder', this.path + 'dialogs/epplaceholder.js' );

            editor.widgets.add( 'epplaceholder', {
                dialog: 'epplaceholder',
                //pathName: lang.pathName,
                // We need to have wrapping element, otherwise there are issues in add dialog.
                template: '<span class="cke_epplaceholder">[[]]</span>',
                draggable: false,

                downcast: function() {
                    return new CKEDITOR.htmlParser.text( '&#91;&#91;' + this.data.name + '&#93;&#93;' );
                },

                init: function() {
                    // Note that placeholder markup characters are stripped for the name.
                    this.setData( 'name', this.element.getText().slice( 2, -2 ) );

                },

                data: function() {
                    this.element.setText( this.data.name );
                },

                getLabel: function() {
                    return this.editor.lang.widget.label.replace( /%1/, this.data.name + ' ' + this.pathName );
                },

                //This function is used to disallow editor to lock while double click on placeholder
                edit: function() {
                    return false;
                }
            } );
        },

        afterInit: function( editor ) {
            var placeholderReplaceRegex = /\[\[(\w|\s)*.*\]\]/;

            editor.dataProcessor.dataFilter.addRules( {
                text: function( text, node ) {
                    var dtd = node.parent && CKEDITOR.dtd[ node.parent.name ];

                    // Skip the case when placeholder is in elements like <title> or <textarea>
                    // but upcast placeholder in custom elements (no DTD).
                    if( dtd && !dtd.span )
                        return;

                    const cke_place_holder = text.replace( placeholderReplaceRegex, function( match ) {
                        // Creating widget code.
                        var widgetWrapper = null,
                            innerElement = new CKEDITOR.htmlParser.element( 'span', {
                                'class': 'cke_epplaceholder'
                            } );
                        // Adds placeholder identifier as innertext.
                        innerElement.add( new CKEDITOR.htmlParser.text( match ) );
                        widgetWrapper = editor.widgets.wrapElement( innerElement, 'epplaceholder' );

                        // Return outerhtml of widget wrapper so it will be placed
                        // as replacement.
                        return widgetWrapper.getOuterHtml();
                    } );
                    return cke_place_holder
                }
            } );
        }
    } );

} )();

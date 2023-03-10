/**
 * @license Copyright (c) 2003-2018, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @fileOverview The "placeholder" plugin for Visual Prediction.
 *
 */

'use strict';

( function() {
    CKEDITOR.plugins.add( 'epplaceholderVisuals', {
        requires: 'widget,dialog',
        icons: 'epplaceholderVisuals', // %REMOVE_LINE_CORE%
        hidpi: true, // %REMOVE_LINE_CORE%

        onLoad: function() {
            // Register styles for epplaceholderVisuals widget frame.
            CKEDITOR.addCss( '.cke_epplaceholder_visuals{background-color:#fff;color:#009898}' );
            CKEDITOR.addCss( '.cke_widget_wrapper:hover>.cke_widget_element{outline:none}' );
            CKEDITOR.addCss( '.cke_widget_wrapper.cke_widget_focused>.cke_widget_element, .cke_widget_wrapper .cke_widget_editable.cke_widget_editable_focused{outline:none}' );
        },

        init: function( editor ) {

            // Register dialog.
            CKEDITOR.dialog.add( 'epPlaceholderVisuals', this.path + 'dialogs/epplaceholderVisuals.js' );

            editor.widgets.add( 'epplaceholderVisuals', {
                dialog: 'epPlaceholderVisuals',
                draggable: false,

                downcast: function() {
                    return new CKEDITOR.htmlParser.text( '&#123;&#123;' + this.data.name.slice( 2, -2 ) + '&#125;&#125;' );
                },

                init: function() {
                    // Note that placeholder markup characters are stripped for the name.
                    this.setData( 'name', this.element.getText() );

                },

                data: function() {
                    this.element.setText( this.data.name );
                    var txt = this.data.name.replace( "{{", "<a style='color:black'>as seen in: </a>" );
                    this.element.setHtml( txt );
                    this.element.setHtml( txt.replace( "}}", "" ) );
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
            var placeholderReplaceRegex = /\{\{(\w|\s)*.*\}\}/;

            editor.dataProcessor.dataFilter.addRules( {
                text: function( text, node ) {
                    var dtd = node.parent && CKEDITOR.dtd[ node.parent.name ];

                    if( dtd && !dtd.span ) { return; }

                    const cke_place_holder = text.replace( placeholderReplaceRegex, function( match ) {
                        // Creating widget code.
                        var widgetWrapper = null,
                            innerElement = new CKEDITOR.htmlParser.element( 'span', {
                                'class': 'cke_epplaceholder_visuals'
                            } );

                        innerElement.add( new CKEDITOR.htmlParser.text( match ) );
                        widgetWrapper = editor.widgets.wrapElement( innerElement, 'epplaceholderVisuals' );

                        return widgetWrapper.getOuterHtml();
                    } );
                    return cke_place_holder;
                }
            } );
        }
    } );

} )();

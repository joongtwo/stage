/**
 * @fileOverview The "stx" plugin.
 * This plugin is used to add STX element text to work instructions editor.
 */
'use strict';

( function() {
    CKEDITOR.plugins.add( 'stx', {
        requires: 'widget',

        onLoad: function() {
            // Register styles for stx widget frame.
            CKEDITOR.addCss( 'stx { border: 0.5px solid white;padding: 0 10px; display: block; border-left: 3px solid #009898;}' );
            CKEDITOR.addCss( 'stx:hover {border: 0.5px solid rgba(205,217,225, 0.25); border-left: 3px solid #009898;}' );
            CKEDITOR.addCss( 'stx:HOVER::BEFORE { content: \'Standard Text\'; background-color: rgb(205,217,225); position: absolute; right: -8px; font-weight: bold; font-size: 10px; height: 14px; line-height: 15px; top: -14px; padding: 0 8px 0 7px; font-family: \'Segoe UI\'; color: #555;}}' );
            CKEDITOR.addCss( '.cke_widget_wrapper:HOVER>stx.cke_widget_element { outline: none;}' );
            CKEDITOR.addCss( 'td div>stx { margin: 0 2px; }' );
            CKEDITOR.addCss( 'td div>stx:HOVER::BEFORE { right: 2px; }' );
        },

        init: function( editor ) {
            editor.widgets.add( 'stx', {
                template: '<stx><div></div></stx>',

                upcast: function( el ) {
                    const isStx = el.name === 'stx';
                    const isFirstChildDiv = el.children.length >= 1 && el.children[ 0 ].name === 'div';
                    if (isStx && isFirstChildDiv) {
                        const stxTootip = editor.getStxName(el.attributes.uid);
                        CKEDITOR.addCss(`.css_${el.attributes.uid}:HOVER::BEFORE  {content: \'${stxTootip} \'; background-color: rgb(205,217,225); position: absolute; right: 1px; font-weight: bold; font-size: 12px; height: 14px; line-height: 15px; top: -14px; padding: 0 8px 0 7px; font-family: \'Segoe UI\'; color: #555;} `);
                        el.addClass(`css_${el.attributes.uid}`);
                    }
                    return isStx && isFirstChildDiv;
                }
            } );
        }
    } );

} )();

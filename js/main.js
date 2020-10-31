//execute script when window is loaded
window.onload = function(){

    //SVG dimension variables
    var w = 900, h = 500;

    //Example 1.2 line 1...container block
    var container = d3.select("body") //get the <body> element from the DOM
        .append("svg") //put a new svg in the body
        .attr("width", w) //assign the width
        .attr("height", h) //assign the height
        .attr("class", "container") //always assign a class (as the block name) for styling and future selection
        .style("background-color", "rgba(0,0,0,0.2)"); //only put a semicolon at the end of the block!

    //innerRect block
    var innerRect = container.append("rect") //new rect in SVG
        .datum(400) //single value
        .attr("width", function(d){ //rect width
            return d * 2;
        })
        .attr("height", function(d){ //rect height
            return d;
        })
        .attr("class", "innerRect")
        .attr("x", 50)
        .attr("y", 50)
        .style("fill", "#FFFFFF");
};

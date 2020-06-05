// MAIN FUNCTIONS
$(document).ready((function() {

    // TEST FUNCTION
    for (var i = 1; i <= 10; i++) {
        // Clone the card and append it to the apps list
        var newCard = $('#cardApp' + i).clone()
        $(newCard).appendTo('#divAppsList')

        // Increment all of its id's by one
        $(newCard).attr('id', 'cardApp' + (i + 1))
        $(newCard).find('#appName' + i).attr('id', 'appName' + (i + 1))
        $(newCard).find('#appVersionAuthor' + i).attr('id', 'appVersionAuthor' + (i + 1))
        $(newCard).find('#appDescription' + i).attr('id', 'appDescription' + (i + 1))
        $(newCard).find('#learnApp' + i).attr('id', 'learnApp' + (i + 1))
        $(newCard).find('#installApp' + i).attr('id', 'installApp' + (i + 1))
    }
}));

// BOOTSTRAP VISUAL CALLS
$(document).ready((function() {
    AOS.init({
        disable: "mobile"
    })

    $("#carouselApps").carousel({
        interval: 5e3,
        cycle: !0
    })
}));
(() => {
  // Log In Event

  var auth = firebase.auth(),
    $submitButton = document.getElementById("dd-login-submit"),
    $email = document.getElementById("dd-login-email"),
    $password = document.getElementById("dd-login-password"),
    $errorMessage = document.getElementById("dd-login-errorMessage");

  $errorMessage.style.display = "none";

  $submitButton.onclick = () => {
    var email = $email.value,
      password = $password.value,
      loginError = null;
    auth.signInWithEmailAndPassword(email, password)
      .catch((error) => {
        loginError = error;
        var errorMessage = (loginError.message || "The login failed");
        $errorMessage.innerText = errorMessage;
        $errorMessage.style.display = "block";
      })
      .then(() => {
        if (loginError != null) return;
        location.assign("./console");
      });

  }
})();

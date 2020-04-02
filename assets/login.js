(() => {
  // Log In Event

  var auth = firebase.auth(),
    $submitButton = document.getElementById("dd-login-submit"),
    $email = document.getElementById("dd-login-email"),
    $password = document.getElementById("dd-login-password"),
    $errorMessage = document.getElementById("dd-login-errorMessage");

  $errorMessage.style.display = "none";



  var tryLogin = $submitButton.onclick = () => {

    $errorMessage.style.display = "none";

    $submitButton.disabled = true;

    var email = $email.value,
      password = $password.value,
      loginError = null;
    auth.signInWithEmailAndPassword(email, password)
      .catch((error) => {
        loginError = error;
        $submitButton.disabled = false;
        var errorMessage = (loginError.message || "The login failed");
        $errorMessage.innerText = errorMessage;
        $errorMessage.style.display = "block";
      })
      .then(() => {
        if (loginError != null) return;
        location.assign("./console");
      });

      return true;
  };

  $email.onkeydown = $password.onkeydown = (e) => {
    if(e.key == "Enter") tryLogin() && e.preventDefault();
  };

})();

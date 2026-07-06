import { app } from "./app";
import { env } from "./config/environment";

app.listen(env.PORT, () => {
  console.log(`Server is running on port ${env.PORT}`);
});


import { Stars } from "@react-three/drei";

const StarsContainer = () => {
  return (
    <Stars radius={200} depth={100} count={5000} factor={10} saturation={10} fade={true} speed={1} />
  );
};

export default StarsContainer;